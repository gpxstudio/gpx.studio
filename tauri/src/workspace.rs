//! The files of the engine and the files of the file system.
//!
//! A file of the engine can be linked to a file on the disk (it was opened from it, or saved to
//! it). The engine does not know about it: the links are kept here, with what the two looked like
//! when they last were the same, which tells
//!
//! - whether the file was edited since it was saved (`dirty`), as its structure is not the one it
//!   had then (the structure changes with every edit, and an undo brings it back);
//! - whether the file on the disk changed since (its bytes are not the ones that were read or
//!   written then), which is the case when something else wrote it.
//!
//! At most one folder is open. It is watched, and the files that are saved without a place are put
//! in it. When a folder is open it is watched: the files that appear, change or disappear on the disk are
//! brought into the engine (see `reconcile`), unless the engine holds edits of that file, which
//! are not overwritten (the file is then flagged as `conflict`).

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

/// What to do with the files of a folder that have unsaved edits when the folder is closed.
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
    /// The file on the disk changed while the engine held edits of it.
    #[serde(default)]
    pub conflict: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Workspace {
    /// The folder that is open (and watched).
    pub folder: Option<PathBuf>,
    pub links: BTreeMap<Uuid, Link>,
}

/// What the frontend shows of a file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    /// Where the file is on the disk, absent for a file that only is in the engine.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// The file has edits that are not in the file on the disk (or has no file on the disk).
    pub dirty: bool,
    /// The file on the disk was changed by something else while this one had edits.
    pub conflict: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    pub files: BTreeMap<String, FileStatus>,
}

fn is_gpx(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("gpx"))
}

fn canonical(path: &Path) -> PathBuf {
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

/// The GPX files of a folder and of the folders in it.
pub fn scan(folder: &Path) -> Vec<PathBuf> {
    const MAX_DEPTH: usize = 8;
    const MAX_FILES: usize = 5000;
    let mut found = vec![];
    let mut pending = vec![(folder.to_path_buf(), 0)];
    while let Some((directory, depth)) = pending.pop() {
        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let hidden = entry.file_name().to_string_lossy().starts_with('.');
            if hidden {
                continue;
            }
            if kind.is_dir() && depth < MAX_DEPTH {
                pending.push((path, depth + 1));
            } else if kind.is_file() && is_gpx(&path) && found.len() < MAX_FILES {
                found.push(path);
            }
        }
    }
    found.sort();
    found
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

    /// Whether the file has edits that the file on the disk does not have.
    pub fn is_dirty(&self, engine: &Engine, id: Uuid) -> bool {
        match self.links.get(&id) {
            Some(link) => signature(engine, id) != Some(link.signature),
            None => true,
        }
    }

    /// The status of each file of the engine.
    pub fn state(&self, engine: &Engine) -> WorkspaceState {
        WorkspaceState {
            folder: self
                .folder
                .as_ref()
                .map(|folder| folder.to_string_lossy().into_owned()),
            files: engine
                .order()
                .iter()
                .map(|FileId(id)| {
                    let link = self.links.get(id);
                    (
                        id.to_string(),
                        FileStatus {
                            path: link.map(|link| link.path.to_string_lossy().into_owned()),
                            dirty: self.is_dirty(engine, *id),
                            conflict: link.is_some_and(|link| link.conflict),
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

    /// Forgets the links of the files that are not in the engine anymore.
    pub fn prune(&mut self, engine: &Engine) {
        self.links
            .retain(|id, _| engine.file_structure(&FileId(*id)).is_some());
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
                if let Some(signature) = signature(engine, *id) {
                    self.links.insert(
                        *id,
                        Link {
                            path: path.clone(),
                            signature,
                            disk_hash: hash(bytes),
                            export_hash: export_hash(engine, *id).unwrap_or_default(),
                            conflict: false,
                        },
                    );
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

    /// Opens a folder: the GPX files in it are opened, and kept in line with it from then on (see
    /// `reconcile`). The folder that was open is closed (see `close_folder`, which `unsaved` is
    /// for), and nothing changes if that fails.
    pub fn open_folder(
        &mut self,
        engine: &mut Engine,
        folder: &Path,
        unsaved: Option<Unsaved>,
    ) -> Result<api::Outcome, String> {
        let folder = canonical(folder);
        let closed = if self.folder.as_ref().is_some_and(|open| *open != folder) {
            self.close_folder(engine, unsaved)?
        } else {
            api::Outcome::failed_none()
        };
        self.folder = Some(folder.clone());
        Ok(closed.merge(self.open_files(engine, &scan(&folder), false)))
    }

    /// The files that belong to the open folder: the ones in it, and the new ones, which are
    /// saved in it.
    fn belonging_to_folder(&self, engine: &Engine) -> Vec<Uuid> {
        let Some(folder) = &self.folder else {
            return vec![];
        };
        engine
            .order()
            .iter()
            .map(|FileId(id)| *id)
            .filter(|id| match self.links.get(id) {
                Some(link) => link.path.starts_with(folder),
                None => true,
            })
            .collect()
    }

    /// The files of the open folder that have unsaved edits, the new files included.
    pub fn unsaved_in_folder(&self, engine: &Engine) -> Vec<Uuid> {
        self.belonging_to_folder(engine)
            .into_iter()
            .filter(|id| self.is_dirty(engine, *id))
            .collect()
    }

    /// Closes the open folder: its files are closed. The ones that have unsaved edits, and the new
    /// files that were not saved (they are saved in the folder), are saved first or discarded, as
    /// `unsaved` says; without it they stay open.
    ///
    /// Nothing is closed if saving fails.
    pub fn close_folder(
        &mut self,
        engine: &mut Engine,
        unsaved: Option<Unsaved>,
    ) -> Result<api::Outcome, String> {
        if self.folder.is_none() {
            return Ok(api::Outcome::failed_none());
        }
        let unsaved_ids = self.unsaved_in_folder(engine);
        if unsaved == Some(Unsaved::Save) {
            self.save(engine, &unsaved_ids, &BTreeMap::new())?;
        }
        let closing: Vec<Uuid> = self
            .belonging_to_folder(engine)
            .into_iter()
            .filter(|id| unsaved.is_some() || !unsaved_ids.contains(id))
            .collect();
        self.folder = None;
        for id in &closing {
            self.links.remove(id);
        }
        if closing.is_empty() {
            return Ok(api::Outcome::failed_none());
        }
        Ok(api::sync_files(engine, &[], &closing))
    }

    /// Where to put a file that is not on the disk, in the open folder: named like the file, and
    /// not the name of a file that is there.
    fn free_path(&self, folder: &Path, name: &str) -> PathBuf {
        let name = file_name(name);
        let taken =
            |path: &Path| path.exists() || self.links.values().any(|link| link.path == path);
        let mut path = folder.join(format!("{name}.gpx"));
        let mut number = 2;
        while taken(&path) {
            path = folder.join(format!("{name} ({number}).gpx"));
            number += 1;
        }
        path
    }

    /// Brings what changed on the disk into the engine: for the given paths (or everything that is
    /// in the folder, and everything that is linked, when there are none).
    ///
    /// - A file that is not open is added.
    /// - A file that changed is read again, unless it has edits that the file on the disk does not
    ///   have: it is flagged as a conflict, and what is in the engine stays.
    /// - A file that is gone is deleted, unless it has edits: it becomes a file that only is in
    ///   the engine.
    ///
    /// Gives what that changed in the engine, `None` when nothing.
    pub fn reconcile(
        &mut self,
        engine: &mut Engine,
        changed: Option<&[PathBuf]>,
    ) -> Option<api::Outcome> {
        let folder = self.folder.clone();
        let candidates: Vec<PathBuf> = match changed {
            None => {
                let mut paths = folder.as_deref().map(scan).unwrap_or_default();
                paths.extend(self.links.values().map(|link| link.path.clone()));
                paths
            }
            Some(changed) => {
                let mut paths: Vec<PathBuf> = changed
                    .iter()
                    .filter(|path| {
                        folder
                            .as_ref()
                            .is_some_and(|folder| path.starts_with(folder))
                    })
                    .cloned()
                    .collect();
                // a folder that was removed or moved takes its files with it
                paths.extend(
                    self.links
                        .values()
                        .map(|link| link.path.clone())
                        .filter(|path| changed.iter().any(|other| path.starts_with(other))),
                );
                paths
            }
        };
        let mut candidates: Vec<PathBuf> = candidates
            .into_iter()
            .filter(|path| is_gpx(path) || self.id_of(path).is_some())
            .collect();
        candidates.sort();
        candidates.dedup();

        // the files to bring in, with what to record once they are
        let mut files: Vec<(Uuid, Vec<u8>, String, PathBuf)> = vec![];
        let mut remove = vec![];
        let mut flagged = false;
        for path in candidates {
            let id = self.id_of(&path);
            match fs::read(&path) {
                Ok(bytes) => {
                    let disk_hash = hash(&bytes);
                    match id {
                        Some(id) => {
                            let dirty = self.is_dirty(engine, id);
                            let link = self.links.get_mut(&id).expect("the link exists");
                            if disk_hash == link.disk_hash {
                                continue;
                            }
                            if dirty {
                                link.disk_hash = disk_hash;
                                link.conflict = true;
                                flagged = true;
                            } else {
                                files.push((id, bytes, stem(&path), path));
                            }
                        }
                        None => files.push((Uuid::new_v4(), bytes, stem(&path), path)),
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    if let Some(id) = id {
                        if !self.is_dirty(engine, id) {
                            remove.push(id);
                        }
                        self.links.remove(&id);
                        flagged = true;
                    }
                }
                // a folder, or a file that cannot be read now: it is looked at again when it changes
                Err(_) => {}
            }
        }

        let outcome = if files.is_empty() && remove.is_empty() {
            None
        } else {
            let borrowed: Vec<(Uuid, &[u8], &str)> = files
                .iter()
                .map(|(id, bytes, name, _)| (*id, bytes.as_slice(), name.as_str()))
                .collect();
            let outcome = api::sync_files(engine, &borrowed, &remove);
            for (id, bytes, _, path) in &files {
                match signature(engine, *id) {
                    Some(signature) => {
                        self.links.insert(
                            *id,
                            Link {
                                path: path.clone(),
                                signature,
                                disk_hash: hash(bytes),
                                export_hash: export_hash(engine, *id).unwrap_or_default(),
                                conflict: false,
                            },
                        );
                    }
                    // it could not be read: it is tried again when it changes
                    None => {
                        self.links.remove(id);
                    }
                }
            }
            for id in &remove {
                self.links.remove(id);
            }
            Some(outcome)
        };
        if outcome.is_some() || flagged {
            self.prune(engine);
        }
        outcome.or_else(|| flagged.then(api::Outcome::failed_none))
    }

    /// The files among `ids` that are not on the disk, with the name to propose for them.
    pub fn unlinked(&self, engine: &Engine, ids: &[Uuid]) -> Vec<(Uuid, String)> {
        ids.iter()
            .filter(|id| !self.links.contains_key(id))
            .filter_map(|id| Some((*id, engine.file_structure(&FileId(*id))?.name.clone())))
            .collect()
    }

    /// Writes files to the disk, replacing what is there: they are the same as their file from
    /// then on. `paths` is where to write the ones that are not on the disk yet. Stops at the
    /// first error, the files that were written stay written.
    pub fn save(
        &mut self,
        engine: &Engine,
        ids: &[Uuid],
        paths: &BTreeMap<Uuid, PathBuf>,
    ) -> Result<(), String> {
        let mut result = Ok(());
        for id in ids {
            let path = match self.links.get(id) {
                Some(link) => link.path.clone(),
                None => match (paths.get(id), &self.folder) {
                    (Some(path), _) => canonical(path),
                    // a new file goes in the folder that is open
                    (None, Some(folder)) => {
                        let Some(structure) = engine.file_structure(&FileId(*id)) else {
                            continue;
                        };
                        self.free_path(folder, &structure.name)
                    }
                    (None, None) => continue,
                },
            };
            let Some(bytes) = api::export_file(engine, *id, ExportOptions::ALL) else {
                continue;
            };
            if let Err(error) = write_atomically(&path, &bytes) {
                result = Err(format!("{}: {error}", path.display()));
                break;
            }
            let Some(signature) = signature(engine, *id) else {
                continue;
            };
            // the folder, if there is one, may watch what was just written: the hash tells it is known
            self.links.insert(
                *id,
                Link {
                    path: canonical(&path),
                    signature,
                    disk_hash: hash(&bytes),
                    export_hash: hash(&bytes),
                    conflict: false,
                },
            );
        }
        result
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

        fn ids(&self) -> Vec<Uuid> {
            self.engine.order().iter().map(|id| id.0).collect()
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
        assert_eq!(
            fx.workspace.state(&fx.engine).files[&id.to_string()]
                .path
                .as_deref(),
            path.to_str()
        );

        fx.rename(id, "renamed");
        assert!(fx.workspace.is_dirty(&fx.engine, id));
        // nothing is written before it is saved
        assert!(fs::read_to_string(&path).unwrap().contains(">a<"));

        fx.workspace
            .save(&fx.engine, &[id], &BTreeMap::new())
            .unwrap();
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
        assert!(fs::read_to_string(&path).unwrap().contains(">renamed<"));

        // going back before the save is an edit again
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

        let path = fx.folder.join("fresh.gpx");
        let paths = BTreeMap::from([(id, path.clone())]);
        fx.workspace.save(&fx.engine, &[id], &paths).unwrap();
        assert!(path.exists());
        assert!(!fx.workspace.is_dirty(&fx.engine, id));
        assert!(fx.workspace.unlinked(&fx.engine, &[id]).is_empty());
    }

    #[test]
    fn what_this_app_writes_is_not_a_change_of_the_disk() {
        let mut fx = Fixture::new();
        let path = fx.write("a.gpx", "a");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        let id = fx.ids()[0];
        fx.rename(id, "renamed");
        fx.workspace
            .save(&fx.engine, &[id], &BTreeMap::new())
            .unwrap();
        assert!(
            fx.workspace
                .reconcile(&mut fx.engine, Some(&[path]))
                .is_none()
        );
        assert_eq!(fx.name(id), "renamed");
    }

    #[test]
    fn opening_a_folder_opens_its_files_and_follows_what_happens_to_them() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.write("notes.txt", "not a track");
        fs::create_dir(fx.folder.join("sub")).unwrap();
        fx.write("sub/b.gpx", "b");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        assert_eq!(fx.ids().len(), 2);
        let ids = fx.ids();
        let a_id = ids.iter().copied().find(|id| fx.name(*id) == "a").unwrap();

        // a new file
        let c = fx.write("c.gpx", "c");
        let outcome = fx
            .workspace
            .reconcile(&mut fx.engine, Some(std::slice::from_ref(&c)))
            .unwrap();
        assert!(outcome.changed);
        assert_eq!(fx.ids().len(), 3);

        // the same file again: nothing
        assert!(fx.workspace.reconcile(&mut fx.engine, Some(&[c])).is_none());

        // a file that changed is read again, and stays the same file
        fx.write("a.gpx", "a, edited elsewhere");
        fx.workspace
            .reconcile(&mut fx.engine, Some(std::slice::from_ref(&a)))
            .unwrap();
        assert_eq!(fx.name(a_id), "a, edited elsewhere");
        assert!(!fx.workspace.is_dirty(&fx.engine, a_id));
        assert_eq!(fx.ids().len(), 3);

        // a file that is gone
        fs::remove_file(&a).unwrap();
        fx.workspace.reconcile(&mut fx.engine, Some(&[a])).unwrap();
        assert_eq!(fx.ids().len(), 2);
        assert!(!fx.ids().contains(&a_id));
    }

    #[test]
    fn the_edits_of_a_file_are_not_overwritten_by_the_disk() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        let id = fx.ids()[0];
        fx.rename(id, "mine");

        fx.write("a.gpx", "theirs");
        let outcome = fx
            .workspace
            .reconcile(&mut fx.engine, Some(std::slice::from_ref(&a)));
        assert!(!outcome.is_some_and(|outcome| outcome.changed));
        assert_eq!(fx.name(id), "mine");
        assert!(fx.workspace.state(&fx.engine).files[&id.to_string()].conflict);

        // gone from the disk: it stays, as a file that is only here
        fs::remove_file(&a).unwrap();
        fx.workspace.reconcile(&mut fx.engine, Some(&[a]));
        assert_eq!(fx.ids(), [id]);
        let status = &fx.workspace.state(&fx.engine).files[&id.to_string()];
        assert!(status.path.is_none() && status.dirty);

        // saving it again puts it back
        let paths = BTreeMap::from([(id, fx.folder.join("a.gpx"))]);
        fx.workspace.save(&fx.engine, &[id], &paths).unwrap();
        assert!(!fx.workspace.state(&fx.engine).files[&id.to_string()].conflict);
    }

    #[test]
    fn what_changed_while_the_app_was_closed_is_found_when_it_starts() {
        let mut fx = Fixture::new();
        let a = fx.write("a.gpx", "a");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        let id = fx.ids()[0];
        fx.write("a.gpx", "changed");
        fx.write("new.gpx", "new");
        fx.workspace.reconcile(&mut fx.engine, None).unwrap();
        assert_eq!(fx.name(id), "changed");
        assert_eq!(fx.ids().len(), 2);
        fs::remove_file(a).unwrap();
        fx.workspace.reconcile(&mut fx.engine, None).unwrap();
        assert_eq!(fx.ids().len(), 1);
    }

    #[test]
    fn a_new_file_is_saved_in_the_open_folder_without_a_place() {
        let mut fx = Fixture::new();
        fx.write("fresh.gpx", "already there");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        api::new_file(&mut fx.engine, "a/b: c", None, None, None);
        let new: Vec<Uuid> = fx
            .ids()
            .into_iter()
            .filter(|id| fx.workspace.is_dirty(&fx.engine, *id))
            .collect();
        assert_eq!(new.len(), 2);

        fx.workspace
            .save(&fx.engine, &new, &BTreeMap::new())
            .unwrap();
        // named like the file, not over what is there, and with a name that is valid
        assert!(fx.folder.join("fresh (2).gpx").exists());
        assert!(fx.folder.join("a_b_ c.gpx").exists());
        assert_eq!(
            fx.workspace
                .state(&fx.engine)
                .files
                .values()
                .filter(|f| f.dirty)
                .count(),
            0
        );
    }

    #[test]
    fn opening_another_folder_closes_the_first() {
        let mut fx = Fixture::new();
        fx.write("one.gpx", "one");
        let other = fx.folder.join("other");
        fs::create_dir(&other).unwrap();
        fs::write(other.join("two.gpx"), gpx("two")).unwrap();
        // the first folder is not the parent of the second
        let first = fx.folder.join("first");
        fs::create_dir(&first).unwrap();
        fs::write(first.join("one.gpx"), gpx("one")).unwrap();
        fx.workspace
            .open_folder(&mut fx.engine, &first, None)
            .unwrap();
        let one = fx.ids()[0];
        fx.workspace
            .open_folder(&mut fx.engine, &other, None)
            .unwrap();
        assert_eq!(fx.ids().len(), 1);
        assert!(!fx.ids().contains(&one));
        assert_eq!(fx.name(fx.ids()[0]), "two");
        assert_eq!(
            fx.workspace.folder.as_deref(),
            Some(canonical(&other).as_path())
        );

        // what has edits stays when the folder is closed, and can still be saved where it is
        let two = fx.ids()[0];
        fx.rename(two, "edited");
        let outcome = fx.workspace.close_folder(&mut fx.engine, None).unwrap();
        assert!(!outcome.changed);
        assert_eq!(fx.ids(), [two]);
        assert!(fx.workspace.folder.is_none());
        fx.workspace
            .save(&fx.engine, &[two], &BTreeMap::new())
            .unwrap();
        assert!(
            fs::read_to_string(other.join("two.gpx"))
                .unwrap()
                .contains("edited")
        );
        let clean = fx.workspace.close_folder(&mut fx.engine, None).unwrap();
        assert!(!clean.changed);
    }

    fn folder_with_an_edited_file() -> (Fixture, Uuid) {
        let mut fx = Fixture::new();
        fx.write("a.gpx", "a");
        fx.write("b.gpx", "b");
        fx.workspace
            .open_folder(&mut fx.engine, &fx.folder.clone(), None)
            .unwrap();
        let id = fx.ids().into_iter().find(|id| fx.name(*id) == "a").unwrap();
        fx.rename(id, "edited");
        (fx, id)
    }

    #[test]
    fn the_unsaved_files_of_a_folder_are_known() {
        let (fx, id) = folder_with_an_edited_file();
        assert_eq!(fx.workspace.unsaved_in_folder(&fx.engine), [id]);
    }

    #[test]
    fn closing_a_folder_can_save_the_unsaved_files_first() {
        let (mut fx, _) = folder_with_an_edited_file();
        let outcome = fx
            .workspace
            .close_folder(&mut fx.engine, Some(Unsaved::Save))
            .unwrap();
        assert!(outcome.changed);
        assert!(fx.ids().is_empty());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains("edited")
        );
        assert!(fx.workspace.folder.is_none() && fx.workspace.links.is_empty());
    }

    #[test]
    fn closing_a_folder_can_discard_the_unsaved_files() {
        let (mut fx, _) = folder_with_an_edited_file();
        fx.workspace
            .close_folder(&mut fx.engine, Some(Unsaved::Discard))
            .unwrap();
        assert!(fx.ids().is_empty());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains(">a<")
        );
    }

    #[test]
    fn nothing_is_closed_when_the_unsaved_files_cannot_be_saved() {
        let (mut fx, id) = folder_with_an_edited_file();
        // the file cannot be written: its place is taken by a folder
        fs::remove_file(fx.folder.join("a.gpx")).unwrap();
        fs::create_dir(fx.folder.join("a.gpx")).unwrap();
        let result = fx
            .workspace
            .close_folder(&mut fx.engine, Some(Unsaved::Save));
        assert!(result.is_err());
        assert!(fx.workspace.folder.is_some());
        assert!(fx.ids().contains(&id));
    }

    #[test]
    fn opening_another_folder_applies_the_choice_to_the_first() {
        let (mut fx, _) = folder_with_an_edited_file();
        let other = fx.folder.join("other");
        fs::create_dir(&other).unwrap();
        fs::write(other.join("c.gpx"), gpx("c")).unwrap();
        // the folder that is open contains the other one: use two separate ones instead
        let elsewhere = canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
        fs::create_dir_all(&elsewhere).unwrap();
        fs::write(elsewhere.join("d.gpx"), gpx("d")).unwrap();
        fx.workspace
            .open_folder(&mut fx.engine, &elsewhere, Some(Unsaved::Discard))
            .unwrap();
        assert_eq!(fx.ids().len(), 1);
        assert_eq!(fx.name(fx.ids()[0]), "d");
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains(">a<")
        );
        fs::remove_dir_all(elsewhere).unwrap();
    }

    #[test]
    fn new_files_belong_to_the_open_folder_and_follow_its_unsaved_choice() {
        let (mut fx, edited) = folder_with_an_edited_file();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        let fresh = *fx
            .ids()
            .iter()
            .find(|id| **id != edited && fx.name(**id) == "fresh")
            .unwrap();
        let unsaved = fx.workspace.unsaved_in_folder(&fx.engine);
        assert!(unsaved.contains(&edited) && unsaved.contains(&fresh));

        // saved in the folder when it is closed
        fx.workspace
            .close_folder(&mut fx.engine, Some(Unsaved::Save))
            .unwrap();
        assert!(fx.ids().is_empty());
        assert!(fx.folder.join("fresh.gpx").exists());
        assert!(
            fs::read_to_string(fx.folder.join("a.gpx"))
                .unwrap()
                .contains("edited")
        );
    }

    #[test]
    fn new_files_are_discarded_with_the_folder_or_stay_without_a_choice() {
        let (mut fx, edited) = folder_with_an_edited_file();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        // without a choice the unsaved files stay, the new one as well
        fx.workspace.close_folder(&mut fx.engine, None).unwrap();
        assert!(fx.ids().contains(&edited));
        assert!(fx.ids().iter().any(|id| fx.name(*id) == "fresh"));
        assert!(fx.workspace.folder.is_none());

        let (mut fx, _) = folder_with_an_edited_file();
        api::new_file(&mut fx.engine, "fresh", None, None, None);
        fx.workspace
            .close_folder(&mut fx.engine, Some(Unsaved::Discard))
            .unwrap();
        assert!(fx.ids().is_empty());
        assert!(!fx.folder.join("fresh.gpx").exists());
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
        workspace.open_folder(&mut engine, &folder, None).unwrap();
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
}
