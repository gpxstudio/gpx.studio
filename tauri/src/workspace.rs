//! The files of the engine and the files of the file system.
//!
//! A file of the engine has a place, which is one of
//!
//! - a file on the disk it is linked to (`Link`): it was opened from it, or saved to it;
//! - a folder (`Workspace::dirs`): it comes from a file of that folder (or was created in it) and
//!   is written in it, under a name of its own, the first time it is saved;
//! - nothing: it was created when no folder was open, and the user chooses where it goes when it is
//!   first saved.
//!
//! The engine does not know about it: the places are kept here. A link also has what the two files
//! looked like when they last were the same, which tells
//!
//! - whether the file was edited since it was saved (its structure is not the one it had then: it
//!   changes with every edit, and an undo brings it back);
//! - whether the file on the disk changed since (`replaced`: its bytes are not the ones that were
//!   read or written then), which is the case when something else wrote it, or is gone (`missing`).
//!
//! A file is shown `dirty` in all those cases, but only `replaced` asks the user before it is
//! saved, as it would overwrite something that was not made here.
//!
//! At most one folder is open. It is watched, and the folder tree is read from the disk when the
//! user opens branches of it (`list_folder`): its files are not opened. The files that are open and
//! are linked are checked again when something changes on the disk (see `reconcile`): a file without
//! edits is read again, a file with edits is flagged `replaced` and the user chooses when saving it
//! whether to overwrite the disk or to read it again (`reload`).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::Engine;
use gpx_engine::{ExportOptions, FileId, api};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::store::write_atomically;

/// The hash of some bytes (FNV-1a), which is the same in every session.
pub fn hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}

/// What a file of the engine looks like: its structure holds the identity of everything that was
/// edited in it. The identities of the contents change when the engine starts again, which is why
/// `Workspace::verify` checks the content of the files that are linked then.
pub fn export_hash(engine: &Engine, id: Uuid) -> Option<u64> {
    Some(hash(&engine.export(&FileId(id), ExportOptions::ALL)?))
}

pub fn signature(engine: &Engine, id: Uuid) -> Option<u64> {
    let structure = api::file_structure(engine, id)?;
    Some(hash(&serde_json::to_vec(&structure).ok()?))
}

/// What to do with the files that have unsaved edits when they are closed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Unsaved {
    /// Write them to their file first.
    Save,
    /// Close them, the edits are lost.
    Discard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    pub path: PathBuf,
    /// The signature of the file of the engine when it was last the one on the disk.
    pub signature: u64,
    /// The hash of the bytes of the file on the disk when it was last read or written here.
    pub disk_hash: u64,
    /// The hash of what the engine writes for the file (`export`) then, which does not depend on
    /// the identities in the engine: it tells whether a file is still the same after a restart.
    /// Zero when it is not known.
    #[serde(default)]
    pub export_hash: u64,
    /// The file on the disk is not the one that was read or written: something else replaced it.
    #[serde(default, alias = "conflict")]
    pub replaced: bool,
    /// The file on the disk is gone.
    #[serde(default)]
    pub missing: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Workspace {
    /// The folder that is open (and watched).
    pub folder: Option<PathBuf>,
    pub links: BTreeMap<Uuid, Link>,
    /// The folder where the files that are not on the disk yet are written.
    #[serde(default)]
    pub dirs: BTreeMap<Uuid, PathBuf>,
}

/// What the frontend shows of a file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    /// Where the file is on the disk, absent for a file that is not on the disk yet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// The folder where the file will be written, for a file that is not on the disk yet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    /// The file is not the one on the disk: it has edits, is not on the disk, or the file on the
    /// disk is not what was read (or is gone).
    pub dirty: bool,
    /// The file on the disk was replaced by something else: saving overwrites it.
    pub replaced: bool,
    /// The file on the disk is gone.
    pub missing: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    pub files: BTreeMap<String, FileStatus>,
}

/// A folder or a GPX file of the open folder, see `Workspace::list_folder`.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn is_gpx(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("gpx"))
}

pub fn canonical(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// What the engine writes for a file that was read from the disk and not edited, for a link that
/// does not know it: `None` if the file on the disk is not the one that was read anymore.
fn saved_export_hash(link: &Link) -> Option<u64> {
    let bytes = fs::read(&link.path).ok()?;
    if hash(&bytes) != link.disk_hash {
        return None;
    }
    let id = Uuid::new_v4();
    let mut scratch = Engine::default();
    api::sync_files(&mut scratch, &[(id, &bytes, &stem(&link.path))], &[]);
    export_hash(&scratch, id)
}

/// A name that can be the one of a file, on every system.
fn file_name(name: &str) -> String {
    let name: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let name = name.trim().trim_matches('.').trim();
    let name: String = name.chars().take(100).collect();
    if name.is_empty() {
        "track".to_owned()
    } else {
        name
    }
}

fn stem(path: &Path) -> String {
    path.file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Where to put a file named `name` in `folder`: not the place of something that is there, or that
/// `taken` says is.
pub fn free_path(folder: &Path, name: &str, taken: impl Fn(&Path) -> bool) -> PathBuf {
    let name = file_name(name);
    let taken = |path: &Path| path.exists() || taken(path);
    let mut path = folder.join(format!("{name}.gpx"));
    let mut number = 2;
    while taken(&path) {
        path = folder.join(format!("{name} ({number}).gpx"));
        number += 1;
    }
    path
}

/// Where to put one of several files that are called the same in `folder`: `name (1)`, or else the
/// first number that is free.
pub fn numbered_path(folder: &Path, name: &str, taken: impl Fn(&Path) -> bool) -> PathBuf {
    let name = file_name(name);
    (1..)
        .map(|number| folder.join(format!("{name} ({number}).gpx")))
        .find(|path| !path.exists() && !taken(path))
        .expect("there are enough numbers")
}

impl Workspace {
    pub fn path() -> &'static str {
        "workspace.json"
    }

    pub fn load(root: &Path) -> Self {
        fs::read(root.join(Self::path()))
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    pub fn write(&self, root: &Path) {
        if let Ok(json) = serde_json::to_vec(self)
            && let Err(error) = write_atomically(&root.join(Self::path()), &json)
        {
            eprintln!("the workspace could not be kept: {error}");
        }
    }

    fn id_of(&self, path: &Path) -> Option<Uuid> {
        self.links
            .iter()
            .find_map(|(id, link)| (link.path == path).then_some(*id))
    }

    /// Whether the file is not the one on the disk: it has edits, or is not on the disk, or the
    /// file on the disk is not the one that was read (or is gone).
    pub fn is_dirty(&self, engine: &Engine, id: Uuid) -> bool {
        match self.links.get(&id) {
            Some(link) => {
                link.replaced || link.missing || signature(engine, id) != Some(link.signature)
            }
            None => true,
        }
    }

    /// The status of each file of the engine.
    pub fn state(&self, engine: &Engine) -> WorkspaceState {
        let text = |path: &Path| path.to_string_lossy().into_owned();
        WorkspaceState {
            folder: self.folder.as_deref().map(text),
            files: engine
                .order()
                .iter()
                .map(|FileId(id)| {
                    let link = self.links.get(id);
                    (
                        id.to_string(),
                        FileStatus {
                            path: link.map(|link| text(&link.path)),
                            folder: self
                                .dirs
                                .get(id)
                                .filter(|_| link.is_none())
                                .map(|dir| text(dir)),
                            dirty: self.is_dirty(engine, *id),
                            replaced: link.is_some_and(|link| link.replaced),
                            missing: link.is_some_and(|link| link.missing),
                        },
                    )
                })
                .collect(),
        }
    }

    /// Checks the links when the engine has started again: it gives new identities to what it holds
    /// (see `signature`), so a file that is the one that was saved looks edited. A file is the same
    /// if what the engine writes for it is what it wrote then; its signature is then the current
    /// one, and the file is not unsaved. A file that has really been edited stays so.
    ///
    /// A link made before the content was kept has the file on the disk to tell what was saved,
    /// if it is still the one that was read.
    pub fn verify(&mut self, engine: &Engine) {
        for (id, link) in self.links.iter_mut() {
            let (Some(current), Some(exported)) =
                (signature(engine, *id), export_hash(engine, *id))
            else {
                continue;
            };
            if link.export_hash == 0 {
                link.export_hash = saved_export_hash(link).unwrap_or_default();
            }
            if current != link.signature && exported == link.export_hash {
                link.signature = current;
            }
        }
    }

    /// Forgets the places of the files that are not in the engine anymore.
    pub fn prune(&mut self, engine: &Engine) {
        let open = |id: &Uuid| engine.file_structure(&FileId(*id)).is_some();
        self.links.retain(|id, _| open(id));
        self.dirs.retain(|id, _| open(id));
    }

    /// Opens files from the disk: the ones that are not open yet are added, and `select` selects
    /// the first of the files that were given (open or not). Says what changed, and which
    /// files could not be read.
    pub fn open_files(
        &mut self,
        engine: &mut Engine,
        paths: &[PathBuf],
        select: bool,
    ) -> api::Outcome {
        let mut new = vec![];
        let mut known = vec![];
        let mut unreadable = vec![];
        for path in paths {
            let path = canonical(path);
            if let Some(id) = self.id_of(&path) {
                known.push(id);
                continue;
            }
            match fs::read(&path) {
                Ok(bytes) => new.push((Uuid::new_v4(), bytes, stem(&path), path)),
                Err(error) => unreadable.push(format!("{}: {error}", path.display())),
            }
        }
        let mut outcome = api::Outcome::failed_none();
        if !new.is_empty() {
            let files: Vec<(Uuid, &[u8], &str)> = new
                .iter()
                .map(|(id, bytes, name, _)| (*id, bytes.as_slice(), name.as_str()))
                .collect();
            outcome = api::sync_files(engine, &files, &[]);
            for (id, bytes, _, path) in &new {
                if let Some(link) = self.new_link(engine, *id, path.clone(), bytes) {
                    self.links.insert(*id, link);
                    known.push(*id);
                }
            }
        }
        if select && let Some(first) = known.first() {
            outcome = outcome.merge(api::select(
                engine,
                &[*first],
                gpx_engine::SelectMode::Replace,
            ));
        }
        if !outcome.has_error() && !unreadable.is_empty() {
            outcome = outcome.merge(api::Outcome::failed(unreadable.join("; ")));
        }
        outcome
    }

    /// The link of a file that is the one on the disk, which has the given bytes. `None` if the
    /// engine does not have the file.
    fn new_link(&self, engine: &Engine, id: Uuid, path: PathBuf, bytes: &[u8]) -> Option<Link> {
        Some(Link {
            path,
            signature: signature(engine, id)?,
            disk_hash: hash(bytes),
            export_hash: export_hash(engine, id).unwrap_or_default(),
            replaced: false,
            missing: false,
        })
    }

    /// Opens a folder, which is watched. Its files are not opened: the user picks them in the tree
    /// (`list_folder`). The folder that was open is closed with its files: see `close_folder`,
    /// which `discard` is for.
    pub fn open_folder(
        &mut self,
        engine: &mut Engine,
        folder: &Path,
        discard: bool,
    ) -> api::Outcome {
        let folder = canonical(folder);
        let closed = if self.folder.as_ref().is_some_and(|open| *open != folder) {
            self.close_folder(engine, discard)
        } else {
            api::Outcome::failed_none()
        };
        self.folder = Some(folder);
        closed
    }

    /// What to watch on the disk: the open folder and the folders in it, and the folder of each
    /// linked file that is outside of it (only that folder: the file is replaced when it is saved,
    /// which a watch on the file itself would not follow). The `bool` says whether to go into the
    /// folders. Only folders that exist.
    pub fn watched(&self) -> Vec<(PathBuf, bool)> {
        let mut watched: Vec<(PathBuf, bool)> = vec![];
        if let Some(folder) = self.folder.as_ref().filter(|folder| folder.is_dir()) {
            watched.push((folder.clone(), true));
        }
        let mut parents: Vec<PathBuf> = self
            .links
            .values()
            .filter(|link| !self.in_folder(&link.path))
            .filter_map(|link| link.path.parent().map(Path::to_path_buf))
            .filter(|parent| parent.is_dir())
            .collect();
        parents.sort();
        parents.dedup();
        watched.extend(parents.into_iter().map(|parent| (parent, false)));
        watched
    }

    /// Whether the path is in the open folder (or is it).
    fn in_folder(&self, path: &Path) -> bool {
        self.folder
            .as_ref()
            .is_some_and(|folder| path.starts_with(folder))
    }

    /// The files among `ids` that are not the ones on the disk.
    pub fn unsaved(&self, engine: &Engine, ids: &[Uuid]) -> Vec<Uuid> {
        ids.iter()
            .copied()
            .filter(|id| engine.file_structure(&FileId(*id)).is_some())
            .filter(|id| self.is_dirty(engine, *id))
            .collect()
    }

    /// Every file of the engine.
    pub fn all(&self, engine: &Engine) -> Vec<Uuid> {
        engine.order().iter().map(|FileId(id)| *id).collect()
    }

    /// Closes files, which are not in the engine anymore. The ones that are not the files on the
    /// disk stay open, unless `discard` says their edits are lost.
    pub fn close_files(
        &mut self,
        engine: &mut Engine,
        ids: &[Uuid],
        discard: bool,
    ) -> api::Outcome {
        let closing: Vec<Uuid> = ids
            .iter()
            .copied()
            .filter(|id| engine.file_structure(&FileId(*id)).is_some())
            .filter(|id| discard || !self.is_dirty(engine, *id))
            .collect();
        if closing.is_empty() {
            return api::Outcome::failed_none();
        }
        for id in &closing {
            self.links.remove(id);
            self.dirs.remove(id);
        }
        api::sync_files(engine, &[], &closing)
    }

    /// Closes the open folder, and everything that is open with it: the workspace starts over.
    /// What is not the file on the disk stays open unless `discard` says its edits are lost, and
    /// the folder is closed anyway.
    pub fn close_folder(&mut self, engine: &mut Engine, discard: bool) -> api::Outcome {
        let ids = self.all(engine);
        let outcome = self.close_files(engine, &ids, discard);
        self.folder = None;
        outcome
    }

    /// Where a new file created from the given files goes: the folder of the first of them that
    /// has a place in the open folder, `None` if there is none. A file that is not in the open folder
    /// has nothing to hand down.
    pub fn source_dir(&self, ids: &[Uuid]) -> Option<PathBuf> {
        ids.iter().find_map(|id| {
            let dir = match self.links.get(id) {
                Some(link) => link.path.parent()?.to_path_buf(),
                None => self.dirs.get(id)?.clone(),
            };
            self.in_folder(&dir).then_some(dir)
        })
    }

    /// The new files among `ids` are written in `dir` when they are saved (unless they have a
    /// place already).
    pub fn inherit(&mut self, ids: &[String], dir: &Path) {
        for id in ids.iter().filter_map(|id| Uuid::parse_str(id).ok()) {
            if !self.links.contains_key(&id) {
                self.dirs.insert(id, dir.to_path_buf());
            }
        }
    }

    /// Brings what changed on the disk into the open files, for the given paths (or for all of the
    /// linked ones when there are none):
    ///
    /// - a file that has no edits and is not what is on the disk anymore is read again, one undo
    ///   step: it stays the same file;
    /// - a file that has edits is `replaced`, nothing is read: saving it overwrites the file on the
    ///   disk, which the user is asked first;
    /// - a file that is gone is `missing`, it stays open;
    /// - the flags are cleared when the file on the disk is the one that was read or written.
    ///
    /// Says what changed in the engine, `None` when nothing changed, not even a flag.
    pub fn reconcile(
        &mut self,
        engine: &mut Engine,
        changed: Option<&[PathBuf]>,
    ) -> Option<api::Outcome> {
        let mut flagged = false;
        let mut to_reload = vec![];
        let ids: Vec<Uuid> = self.links.keys().copied().collect();
        for id in ids {
            let edited = signature(engine, id) != Some(self.links[&id].signature);
            let link = self.links.get_mut(&id).expect("the link exists");
            if let Some(changed) = changed
                && !changed
                    .iter()
                    .any(|path| link.path.starts_with(path) || path.starts_with(&link.path))
            {
                continue;
            }
            let (differs, missing) = match fs::read(&link.path) {
                Ok(bytes) => (hash(&bytes) != link.disk_hash, false),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (false, true),
                // a folder, or a file that cannot be read now: it is looked at again when it changes
                Err(_) => continue,
            };
            if differs && !edited {
                to_reload.push(id);
                continue;
            }
            let replaced = differs;
            if (replaced, missing) != (link.replaced, link.missing) {
                link.replaced = replaced;
                link.missing = missing;
                flagged = true;
            }
        }
        let reloaded = if to_reload.is_empty() {
            None
        } else {
            self.reload(engine, &to_reload).ok()
        };
        match reloaded {
            Some(outcome) => Some(outcome),
            None => flagged.then(api::Outcome::failed_none),
        }
    }

    /// Reads files again from the disk: they become the files that are there (one undo step for
    /// each), and are not dirty anymore. Stops at the first one that cannot be read.
    pub fn reload(&mut self, engine: &mut Engine, ids: &[Uuid]) -> Result<api::Outcome, String> {
        let mut files = vec![];
        for id in ids {
            let Some(link) = self.links.get(id) else {
                continue;
            };
            let bytes = fs::read(&link.path)
                .map_err(|error| format!("{}: {error}", link.path.display()))?;
            files.push((*id, bytes, stem(&link.path)));
        }
        let borrowed: Vec<(Uuid, &[u8], &str)> = files
            .iter()
            .map(|(id, bytes, name)| (*id, bytes.as_slice(), name.as_str()))
            .collect();
        let outcome = api::sync_files(engine, &borrowed, &[]);
        for (id, bytes, _) in &files {
            let path = self.links[id].path.clone();
            if let Some(link) = self.new_link(engine, *id, path, bytes) {
                self.links.insert(*id, link);
            }
        }
        Ok(outcome)
    }

    /// The files among `ids` that are written by the first save to a place the user chooses: the
    /// ones that are not on the disk, and not linked to a folder either. With the name to propose.
    pub fn unlinked(&self, engine: &Engine, ids: &[Uuid]) -> Vec<(Uuid, String)> {
        ids.iter()
            .filter(|id| !self.links.contains_key(id) && !self.dirs.contains_key(id))
            .filter_map(|id| Some((*id, engine.file_structure(&FileId(*id))?.name.clone())))
            .collect()
    }

    fn is_taken(&self, path: &Path) -> bool {
        self.links.values().any(|link| link.path == path)
    }

    /// Writes files to the disk, replacing what is there: they are the same as their file from
    /// then on. A file that is not on the disk goes in its folder, or at its path in `paths`, or in
    /// `folder`, under its name (changed if that is the one of something else). Stops at the first
    /// error, the files that were written stay written.
    pub fn save(
        &mut self,
        engine: &Engine,
        ids: &[Uuid],
        paths: &BTreeMap<Uuid, PathBuf>,
        folder: Option<&Path>,
    ) -> Result<(), String> {
        for id in ids {
            let Some(structure) = engine.file_structure(&FileId(*id)) else {
                continue;
            };
            let in_folder = |dir: &Path| free_path(dir, &structure.name, |p| self.is_taken(p));
            let path = match (self.links.get(id), paths.get(id), self.dirs.get(id), folder) {
                (Some(link), ..) => link.path.clone(),
                (None, Some(path), ..) => canonical(path),
                (None, None, Some(dir), _) => in_folder(dir),
                (None, None, None, Some(dir)) => in_folder(dir),
                (None, None, None, None) => continue,
            };
            self.write_file(engine, *id, &path)?;
        }
        Ok(())
    }

    /// Writes the new files among `files` in their folder, each under the name that is given (the
    /// name in the file when there is none). A name that is the one of something else is changed
    /// (`name (2)`). Files that would be called the same, like the parts of a split, are numbered
    /// from 1 (`name (1)`, `name (2)`).
    pub fn save_new(
        &mut self,
        engine: &Engine,
        files: &[(Uuid, Option<String>)],
    ) -> Result<(), String> {
        let names: Vec<Option<(Uuid, PathBuf, String)>> = files
            .iter()
            .map(|(id, name)| {
                let dir = self.dirs.get(id)?.clone();
                let structure = engine.file_structure(&FileId(*id))?;
                Some((
                    *id,
                    dir,
                    name.clone().unwrap_or_else(|| structure.name.clone()),
                ))
            })
            .collect();
        for entry in &names {
            let Some((id, dir, name)) = entry else {
                continue;
            };
            let together = names
                .iter()
                .flatten()
                .filter(|(_, other_dir, other)| {
                    other_dir == dir && file_name(other) == file_name(name)
                })
                .count()
                > 1;
            let path = if together {
                numbered_path(dir, name, |p| self.is_taken(p))
            } else {
                free_path(dir, name, |p| self.is_taken(p))
            };
            self.write_file(engine, *id, &path)?;
        }
        Ok(())
    }

    /// The name of a file as the user knows it: the name of the file on the disk, without its
    /// extension, or else the name in the file.
    pub fn display_name(&self, engine: &Engine, id: Uuid) -> Option<String> {
        match self.links.get(&id) {
            Some(link) => Some(stem(&link.path)),
            None => Some(engine.file_structure(&FileId(id))?.name.clone()),
        }
    }

    /// Writes a file to a path of the user's choice, which is the place of the file from then on.
    pub fn save_as(&mut self, engine: &Engine, id: Uuid, path: &Path) -> Result<(), String> {
        if let Some(other) = self.id_of(&canonical(path))
            && other != id
        {
            return Err(format!("{} is open already", path.display()));
        }
        self.write_file(engine, id, path)
    }

    fn write_file(&mut self, engine: &Engine, id: Uuid, path: &Path) -> Result<(), String> {
        let Some(bytes) = api::export_file(engine, id, ExportOptions::ALL) else {
            return Ok(());
        };
        write_atomically(path, &bytes).map_err(|error| format!("{}: {error}", path.display()))?;
        let Some(signature) = signature(engine, id) else {
            return Ok(());
        };
        // the folder, if there is one, may watch what was just written: the hash tells it is known
        self.links.insert(
            id,
            Link {
                path: canonical(path),
                signature,
                disk_hash: hash(&bytes),
                export_hash: hash(&bytes),
                replaced: false,
                missing: false,
            },
        );
        self.dirs.remove(&id);
        Ok(())
    }

    /// The folders and the GPX files that are in a folder of the open folder (or in it), the
    /// folders first and then alphabetically. Hidden files are left out.
    pub fn list_folder(&self, folder: &Path) -> Result<Vec<Entry>, String> {
        let folder = canonical(folder);
        if !self.in_folder(&folder) {
            return Err(format!("{} is not in the open folder", folder.display()));
        }
        let mut entries: Vec<Entry> = fs::read_dir(&folder)
            .map_err(|error| format!("{}: {error}", folder.display()))?
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().into_owned();
                let path = entry.path();
                let is_dir = fs::metadata(&path).ok()?.is_dir();
                (!name.starts_with('.') && (is_dir || is_gpx(&path))).then(|| Entry {
                    name,
                    path: path.to_string_lossy().into_owned(),
                    is_dir,
                })
            })
            .collect();
        entries.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
                .then_with(|| a.name.cmp(&b.name))
        });
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use gpx_engine::SelectMode;

    use super::*;

    fn gpx(name: &str) -> String {
        format!(
            r#"<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>{name}</name></metadata><trk><trkseg><trkpt lat="50.0" lon="4.0"><ele>10</ele></trkpt><trkpt lat="50.1" lon="4.1"><ele>20</ele></trkpt></trkseg></trk></gpx>"#
        )
    }

    /// The GPX files of a folder and of the folders in it.
    pub(super) fn gpx_files(folder: &Path) -> Vec<PathBuf> {
        let mut found = vec![];
        for entry in fs::read_dir(folder).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                found.extend(gpx_files(&path));
            } else if is_gpx(&path) {
                found.push(path);
            }
        }
        found.sort();
        found
    }

    struct Fixture {
        folder: PathBuf,
        engine: Engine,
        workspace: Workspace,
    }

    impl Fixture {
        fn new() -> Self {
            let folder =
                canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
            fs::create_dir_all(&folder).unwrap();
            Self {
                folder,
                engine: Engine::default(),
                workspace: Workspace::default(),
            }
        }

        fn write(&self, name: &str, title: &str) -> PathBuf {
            let path = self.folder.join(name);
            fs::write(&path, gpx(title)).unwrap();
            path
        }

        /// Opens the folder, and all the files that are in it.
        fn open_folder(&mut self) {
            let folder = self.folder.clone();
            self.workspace.open_folder(&mut self.engine, &folder, false);
            let files = gpx_files(&folder);
            self.workspace.open_files(&mut self.engine, &files, false);
        }

        fn reconcile(&mut self, changed: Option<&[PathBuf]>) -> Option<api::Outcome> {
            self.workspace.reconcile(&mut self.engine, changed)
        }

        fn save(&mut self, ids: &[Uuid]) {
            self.workspace
                .save(&self.engine, ids, &BTreeMap::new(), None)
                .unwrap();
        }

        fn ids(&self) -> Vec<Uuid> {
            self.engine.order().iter().map(|id| id.0).collect()
        }

        fn id_named(&self, name: &str) -> Uuid {
            self.ids()
                .into_iter()
                .find(|id| self.name(*id) == name)
                .unwrap()
        }

        fn name(&self, id: Uuid) -> String {
            self.engine
                .file_structure(&FileId(id))
                .unwrap()
                .name
                .clone()
        }

        fn rename(&mut self, id: Uuid, name: &str) {
            api::select(&mut self.engine, &[id], SelectMode::Replace);
            assert!(!api::metadata(&mut self.engine, name, "").has_error());
        }

        fn status(&self, id: Uuid) -> FileStatus {
            self.workspace
                .state(&self.engine)
                .files
                .remove(&id.to_string())
                .unwrap()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.folder);
        }
    }

    #[test]
    fn an_opened_file_is_clean_until_it_is_edited_and_clean_again_once_saved() {
        let mut fx = Fixture::new();
        let path = fx.write("a.gpx", "a");
        fx.workspace
            .open_files(&mut fx.engine, std::slice::from_ref(&path), true);
        let id = fx.ids()[0];
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
        assert_eq!(fx.status(id).path.as_deref(), path.to_str());

        fx.rename(id, "renamed");
        assert!(fx.workspace.is_dirty(&fx.engine, id));
        // nothing is written before it is saved
        assert!(fs::read_to_string(&path).unwrap().contains(">a<"));

        fx.save(&[id]);
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
        assert!(fs::read_to_string(&path).unwrap().contains(">renamed<"));

        // going back before the save is an edit again
        api::select(&mut fx.engine, &[id], SelectMode::Replace);
        api::undo(&mut fx.engine);
        assert!(fx.workspace.is_dirty(&fx.engine, id));
        api::redo(&mut fx.engine);
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
    }

    #[test]
    fn a_file_that_is_not_on_the_disk_is_unsaved_until_it_is_given_a_place() {
        let mut fx = Fixture::new();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        let id = fx.ids()[0];
        assert!(fx.workspace.is_dirty(&fx.engine, id));
        assert_eq!(
            fx.workspace.unlinked(&fx.engine, &[id]),
            [(id, "fresh".to_string())]
        );
        // nowhere to put it without being told
        fx.save(&[id]);
        assert!(fx.workspace.is_dirty(&fx.engine, id));

        let path = fx.folder.join("fresh.gpx");
        let paths = BTreeMap::from([(id, path.clone())]);
        fx.workspace.save(&fx.engine, &[id], &paths, None).unwrap();
        assert!(path.exists());
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
        assert!(fx.workspace.unlinked(&fx.engine, &[id]).is_empty());
    }

    #[test]
    fn several_files_without_a_place_go_in_a_folder_with_names_that_are_free() {
        let mut fx = Fixture::new();
        fx.write("fresh.gpx", "already there");
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        api::new_file(&mut fx.engine, "a/b: c", None, None, None);
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        let ids = fx.ids();
        let folder = fx.folder.clone();
        fx.workspace
            .save(&fx.engine, &ids, &BTreeMap::new(), Some(&folder))
            .unwrap();
        for name in ["fresh (2).gpx", "fresh (3).gpx", "a_b_ c.gpx"] {
            assert!(fx.folder.join(name).exists(), "{name}");
        }
        assert!(ids.iter().all(|id| !fx.workspace.is_dirty(&fx.engine, *id)));
    }

    #[test]
    fn what_this_app_writes_is_not_a_change_of_the_disk() {
        let mut fx = Fixture::new();
        let path = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.rename(id, "renamed");
        fx.save(&[id]);
        assert!(fx.reconcile(Some(&[path])).is_none());
        assert!(!fx.status(id).replaced);
        assert_eq!(fx.name(id), "renamed");
    }

    #[test]
    fn the_folders_of_the_files_outside_the_open_folder_are_watched_too() {
        let mut fx = Fixture::new();
        let inside = fx.write("in.gpx", "in");
        let elsewhere = canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
        fs::create_dir_all(&elsewhere).unwrap();
        let (one, two) = (elsewhere.join("one.gpx"), elsewhere.join("two.gpx"));
        fs::write(&one, gpx("one")).unwrap();
        fs::write(&two, gpx("two")).unwrap();
        let folder = fx.folder.clone();

        // no folder: only the folder of the files
        fx.workspace.open_files(&mut fx.engine, &[one, two], false);
        assert_eq!(fx.workspace.watched(), [(elsewhere.clone(), false)]);

        // the open folder as a whole, and the file in it needs nothing more
        fx.workspace.open_folder(&mut fx.engine, &folder, false);
        fx.workspace.open_files(&mut fx.engine, &[inside], false);
        assert_eq!(
            fx.workspace.watched(),
            [(folder, true), (elsewhere.clone(), false)]
        );

        // closing the files stops it
        let ids = fx.ids();
        fx.workspace.close_files(&mut fx.engine, &ids, true);
        assert_eq!(fx.workspace.watched(), [(fx.folder.clone(), true)]);
        fs::remove_dir_all(elsewhere).unwrap();
    }

    #[test]
    fn opening_a_folder_does_not_open_its_files() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        let folder = fx.folder.clone();
        let outcome = fx.workspace.open_folder(&mut fx.engine, &folder, false);
        assert!(!outcome.changed);
        assert!(fx.ids().is_empty());
        assert_eq!(fx.workspace.folder.as_deref(), Some(folder.as_path()));
    }

    #[test]
    fn the_tree_of_the_folder_shows_folders_first_and_only_gpx_files() {
        let mut fx = Fixture::new();
        fx.write("b.gpx", "b");
        fx.write("A.GPX", "a");
        fx.write("notes.txt", "not a track");
        fx.write(".hidden.gpx", "hidden");
        fs::create_dir(fx.folder.join("zoo")).unwrap();
        fs::create_dir(fx.folder.join("Alps")).unwrap();
        fs::create_dir(fx.folder.join(".git")).unwrap();
        fx.write("zoo/c.gpx", "c");
        let folder = fx.folder.clone();
        fx.workspace.open_folder(&mut fx.engine, &folder, false);

        let names = |entries: Vec<Entry>| -> Vec<(String, bool)> {
            entries.into_iter().map(|e| (e.name, e.is_dir)).collect()
        };
        assert_eq!(
            names(fx.workspace.list_folder(&folder).unwrap()),
            [
                ("Alps".to_string(), true),
                ("zoo".to_string(), true),
                ("A.GPX".to_string(), false),
                ("b.gpx".to_string(), false),
            ]
        );
        assert_eq!(
            names(fx.workspace.list_folder(&folder.join("zoo")).unwrap()),
            [("c.gpx".to_string(), false)]
        );
        // only what is in the open folder can be listed
        let elsewhere = canonical(&std::env::temp_dir());
        assert!(fx.workspace.list_folder(&elsewhere).is_err());
    }

    #[test]
    fn a_file_without_edits_is_read_again_when_the_disk_changes() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];

        fx.write("a.gpx", "theirs");
        let outcome = fx.reconcile(Some(std::slice::from_ref(&a))).unwrap();
        assert!(outcome.changed);
        // the same file, now the one on the disk
        assert_eq!(fx.ids(), [id]);
        assert_eq!(fx.name(id), "theirs");
        let status = fx.status(id);
        assert!(!status.dirty && !status.replaced);
        // looking again changes nothing
        assert!(fx.reconcile(Some(std::slice::from_ref(&a))).is_none());
    }

    #[test]
    fn a_file_with_edits_is_flagged_when_the_disk_changes_and_not_read_again() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.rename(id, "mine");

        fx.write("a.gpx", "theirs");
        let outcome = fx.reconcile(Some(std::slice::from_ref(&a))).unwrap();
        assert!(!outcome.changed);
        assert_eq!(fx.name(id), "mine");
        let status = fx.status(id);
        assert!(status.dirty && status.replaced && !status.missing);
        // looking again changes nothing
        assert!(fx.reconcile(Some(std::slice::from_ref(&a))).is_none());

        // the disk goes back to what was read: only the edits are left
        fx.write("a.gpx", "a");
        assert!(fx.reconcile(Some(std::slice::from_ref(&a))).is_some());
        let status = fx.status(id);
        assert!(status.dirty && !status.replaced);
    }

    #[test]
    fn the_user_can_take_the_disk_instead_of_the_edits() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.rename(id, "mine");
        fx.write("a.gpx", "theirs");
        fx.reconcile(None);
        assert!(fx.status(id).replaced);

        fx.workspace.reload(&mut fx.engine, &[id]).unwrap();
        assert_eq!(fx.name(id), "theirs");
        let status = fx.status(id);
        assert!(!status.dirty && !status.replaced);
        // and it is one undo step
        api::select(&mut fx.engine, &[id], SelectMode::Replace);
        api::undo(&mut fx.engine);
        assert_eq!(fx.name(id), "mine");
    }

    #[test]
    fn saving_overwrites_what_replaced_the_file() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.rename(id, "mine");
        fx.write("a.gpx", "theirs");
        fx.reconcile(None);
        assert!(fx.status(id).replaced);

        fx.save(&[id]);
        assert!(fs::read_to_string(a).unwrap().contains(">mine<"));
        assert!(!fx.status(id).replaced && !fx.status(id).dirty);
    }

    #[test]
    fn a_file_that_is_gone_from_the_disk_stays_open_and_dirty_until_it_is_saved_again() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];

        fs::remove_file(&a).unwrap();
        assert!(fx.reconcile(Some(std::slice::from_ref(&a))).is_some());
        assert_eq!(fx.ids(), [id]);
        let status = fx.status(id);
        assert!(status.dirty && status.missing && status.path.is_some());

        // saving puts it back
        fx.save(&[id]);
        assert!(a.exists());
        let status = fx.status(id);
        assert!(!status.dirty && !status.missing);
    }

    #[test]
    fn a_file_that_comes_back_different_is_read_again() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fs::remove_file(&a).unwrap();
        fx.reconcile(None);
        assert!(fx.status(id).missing);

        fx.write("a.gpx", "back");
        fx.reconcile(None);
        assert_eq!(fx.name(id), "back");
        let status = fx.status(id);
        assert!(!status.dirty && !status.missing);
    }

    #[test]
    fn what_changed_while_the_app_was_closed_is_found_when_it_starts() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.write("a.gpx", "changed");
        assert!(fx.reconcile(None).is_some());
        assert_eq!(fx.name(id), "changed");
        fs::remove_file(a).unwrap();
        assert!(fx.reconcile(None).is_some());
        assert!(fx.status(id).missing);
    }

    #[test]
    fn new_files_made_from_a_file_of_the_folder_are_saved_next_to_it() {
        let mut fx = Fixture::new();
        fs::create_dir(fx.folder.join("sub")).unwrap();
        fx.write("sub/b.gpx", "b");
        fx.write("a.gpx", "a");
        fx.open_folder();
        let b = fx.id_named("b");
        let sub = fx.folder.join("sub");
        assert_eq!(fx.workspace.source_dir(&[b]), Some(canonical(&sub)));

        let before = fx.ids();
        api::select(&mut fx.engine, &[b], SelectMode::Replace);
        let outcome = api::duplicate(&mut fx.engine);
        let copy = fx
            .ids()
            .into_iter()
            .find(|id| !before.contains(id))
            .unwrap();
        fx.workspace.inherit(outcome.added(), &canonical(&sub));
        assert_eq!(fx.status(copy).folder.as_deref(), canonical(&sub).to_str());
        assert!(fx.status(copy).path.is_none() && fx.status(copy).dirty);
        // nobody needs to be asked where it goes
        assert!(fx.workspace.unlinked(&fx.engine, &[copy]).is_empty());

        fx.save(&[copy]);
        assert!(sub.join("b (2).gpx").exists());
        let status = fx.status(copy);
        assert!(!status.dirty && status.folder.is_none());
        assert_eq!(
            status.path.as_deref(),
            canonical(&sub.join("b (2).gpx")).to_str()
        );
        // the copy of the copy is next to it as well
        assert_eq!(fx.workspace.source_dir(&[copy]), Some(canonical(&sub)));
    }

    #[test]
    fn a_file_outside_the_open_folder_hands_nothing_down() {
        let mut fx = Fixture::new();
        let elsewhere = canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
        fs::create_dir_all(&elsewhere).unwrap();
        let outside = elsewhere.join("o.gpx");
        fs::write(&outside, gpx("o")).unwrap();
        let folder = fx.folder.clone();
        fx.workspace.open_folder(&mut fx.engine, &folder, false);
        fx.workspace
            .open_files(&mut fx.engine, std::slice::from_ref(&outside), true);
        let id = fx.ids()[0];
        assert_eq!(fx.workspace.source_dir(&[id]), None);
        // a new file with no source is not linked to a folder by `source_dir`: the caller falls back
        fs::remove_dir_all(elsewhere).unwrap();
    }

    #[test]
    fn closing_files_asks_what_to_do_with_the_unsaved_ones() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.write("b.gpx", "b");
        fx.open_folder();
        let (a, b) = (fx.id_named("a"), fx.id_named("b"));
        fx.rename(a, "edited");
        assert_eq!(fx.workspace.unsaved(&fx.engine, &[a, b]), [a]);

        // without a choice what has edits stays
        let outcome = fx.workspace.close_files(&mut fx.engine, &[a, b], false);
        assert!(outcome.changed);
        assert_eq!(fx.ids(), [a]);

        // saved first
        fx.save(&[a]);
        fx.workspace.close_files(&mut fx.engine, &[a], false);
        assert!(fx.ids().is_empty());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains("edited")
        );
        assert!(fx.workspace.links.is_empty());
    }

    #[test]
    fn closing_files_can_discard_their_edits() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        let a = fx.ids()[0];
        fx.rename(a, "edited");
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        let fresh = fx.id_named("fresh");
        fx.workspace.close_files(&mut fx.engine, &[a, fresh], true);
        assert!(fx.ids().is_empty());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains(">a<")
        );
    }

    #[test]
    fn closing_the_folder_closes_every_file() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        assert_eq!(fx.ids().len(), 2);

        // the new file has nowhere to go: it has to be discarded
        let outcome = fx.workspace.close_folder(&mut fx.engine, false);
        assert!(outcome.changed);
        assert_eq!(fx.ids().len(), 1);
        assert!(fx.workspace.folder.is_none());

        let outcome = fx.workspace.close_folder(&mut fx.engine, true);
        assert!(outcome.changed);
        assert!(fx.ids().is_empty());
    }

    #[test]
    fn opening_another_folder_closes_the_first_with_all_its_files() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        let a = fx.ids()[0];
        fx.rename(a, "edited");
        let other = canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
        fs::create_dir_all(&other).unwrap();

        // the edits stay, nothing is lost without a choice
        fx.workspace.open_folder(&mut fx.engine, &other, false);
        assert_eq!(fx.ids(), [a]);
        assert_eq!(fx.workspace.folder.as_deref(), Some(other.as_path()));

        let first = fx.folder.clone();
        fx.workspace.open_folder(&mut fx.engine, &first, true);
        assert!(fx.ids().is_empty());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains(">a<")
        );
        fs::remove_dir_all(other).unwrap();
    }

    #[test]
    fn opening_the_same_folder_again_changes_nothing() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        let folder = fx.folder.clone();
        let outcome = fx.workspace.open_folder(&mut fx.engine, &folder, true);
        assert!(!outcome.changed);
        assert_eq!(fx.ids().len(), 1);
    }

    #[test]
    fn a_failed_save_stops_at_the_file_and_leaves_it_dirty() {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.open_folder();
        let id = fx.ids()[0];
        fx.rename(id, "edited");
        // the place of the file is taken by a folder
        fs::remove_file(fx.folder.join("a.gpx")).unwrap();
        fs::create_dir(fx.folder.join("a.gpx")).unwrap();
        let result = fx.workspace.save(&fx.engine, &[id], &BTreeMap::new(), None);
        assert!(result.is_err());
        assert!(fx.workspace.is_dirty(&fx.engine, id));
    }

    #[test]
    fn saving_as_gives_the_file_another_place() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.write("b.gpx", "b");
        fx.open_folder();
        let id = fx.id_named("a");
        let other = fx.id_named("b");
        fx.rename(id, "edited");

        let target = fx.folder.join("copy.gpx");
        fx.workspace.save_as(&fx.engine, id, &target).unwrap();
        assert!(fs::read_to_string(&target).unwrap().contains("edited"));
        assert!(fs::read_to_string(a).unwrap().contains(">a<"));
        let status = fx.status(id);
        assert!(!status.dirty);
        assert_eq!(status.path.as_deref(), canonical(&target).to_str());

        // the place of another open file is not available
        let taken = fx.folder.join("b.gpx");
        assert!(fx.workspace.save_as(&fx.engine, id, &taken).is_err());
        assert!(!fx.workspace.is_dirty(&fx.engine, other));
    }
}

#[cfg(test)]
mod restart_tests {
    use gpx_engine::Persister;

    use super::*;
    use crate::store::FileStorage;

    /// What the app does when it starts again: the engine and the links are read from what was
    /// kept.
    fn restart(engine: &Engine, workspace: &Workspace, root: &Path) -> (Engine, Workspace) {
        let storage = FileStorage::open(root).unwrap();
        pollster::block_on(Persister::default().save(&storage, engine.snapshot())).unwrap();
        let mut restarted = Engine::default();
        let restored = pollster::block_on(Persister::default().restore(&storage)).unwrap();
        restarted.restore(restored);
        let links = serde_json::to_string(workspace).unwrap();
        (restarted, serde_json::from_str(&links).unwrap())
    }

    fn setup() -> (PathBuf, Engine, Workspace, Vec<Uuid>) {
        let root = std::env::temp_dir().join(format!("gpx-restart-{}", Uuid::new_v4()));
        let folder = root.join("tracks");
        fs::create_dir_all(&folder).unwrap();
        for name in ["with_tracks", "with_time", "with_waypoint"] {
            let _ = fs::copy(
                format!("../gpx-rs/data/{name}.gpx"),
                folder.join(format!("{name}.gpx")),
            );
        }
        let mut engine = Engine::default();
        let mut workspace = Workspace::default();
        workspace.open_folder(&mut engine, &folder, false);
        workspace.open_files(&mut engine, &tests::gpx_files(&folder), false);
        let ids = engine.order().iter().map(|id| id.0).collect();
        (root, engine, workspace, ids)
    }

    #[test]
    fn files_that_were_not_edited_are_not_unsaved_after_a_restart() {
        let (root, engine, workspace, ids) = setup();
        assert!(ids.len() >= 2);
        let (restarted, mut workspace) = restart(&engine, &workspace, &root.join("store"));
        // the files are the same, but the engine knows their contents by new identities
        assert!(ids.iter().any(|id| workspace.is_dirty(&restarted, *id)));
        workspace.verify(&restarted);
        assert!(ids.iter().all(|id| !workspace.is_dirty(&restarted, *id)));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_that_were_edited_are_still_unsaved_after_a_restart() {
        let (root, mut engine, workspace, ids) = setup();
        api::select(&mut engine, &[ids[0]], gpx_engine::SelectMode::Replace);
        api::metadata(&mut engine, "edited", "");
        assert!(workspace.is_dirty(&engine, ids[0]));
        let (restarted, mut workspace) = restart(&engine, &workspace, &root.join("store"));
        workspace.verify(&restarted);
        assert!(workspace.is_dirty(&restarted, ids[0]));
        assert!(
            ids[1..]
                .iter()
                .all(|id| !workspace.is_dirty(&restarted, *id))
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn links_made_before_the_content_was_kept_are_checked_against_the_disk() {
        let (root, mut engine, mut workspace, ids) = setup();
        api::select(&mut engine, &[ids[0]], gpx_engine::SelectMode::Replace);
        api::metadata(&mut engine, "edited", "");
        for link in workspace.links.values_mut() {
            link.export_hash = 0;
        }
        let (restarted, mut workspace) = restart(&engine, &workspace, &root.join("store"));
        workspace.verify(&restarted);
        assert!(workspace.is_dirty(&restarted, ids[0]));
        assert!(
            ids[1..]
                .iter()
                .all(|id| !workspace.is_dirty(&restarted, *id))
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_folders_of_new_files_and_the_old_flag_name_survive_a_restart() {
        let (root, engine, mut workspace, ids) = setup();
        let folder = workspace.folder.clone().unwrap();
        let fresh = Uuid::new_v4();
        workspace.inherit(&[fresh.to_string()], &folder);
        workspace.links.get_mut(&ids[0]).unwrap().replaced = true;
        let json = serde_json::to_string(&workspace).unwrap();
        // links written by the previous version had `conflict`, which is the same thing
        let json = json.replace("\"replaced\"", "\"conflict\"");
        assert!(json.contains("\"conflict\":true"));
        let read: Workspace = serde_json::from_str(&json).unwrap();
        assert!(read.links[&ids[0]].replaced);
        assert_eq!(read.dirs.get(&fresh), Some(&folder));
        let _ = engine;
        fs::remove_dir_all(root).unwrap();
    }
}
