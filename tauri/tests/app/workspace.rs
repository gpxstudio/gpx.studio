//! The places of the files of the engine on the disk (`workspace`).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use gpx_engine::{FileId, SelectMode, api};
use gpx_studio_desktop_lib::Engine;
use gpx_studio_desktop_lib::workspace::*;
use uuid::Uuid;

fn gpx(name: &str) -> String {
    format!(
        r#"<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>{name}</name></metadata><trk><name>{name}</name><trkseg><trkpt lat="50.0" lon="4.0"><ele>10</ele></trkpt><trkpt lat="50.1" lon="4.1"><ele>20</ele></trkpt></trkseg></trk></gpx>"#
    )
}

/// The GPX files of a folder and of the folders in it.
pub fn gpx_files(folder: &Path) -> Vec<PathBuf> {
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
        let folder = canonical(&std::env::temp_dir()).join(format!("gpx-ws-{}", Uuid::new_v4()));
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
            .save(&mut self.engine, ids, &BTreeMap::new(), None)
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

    /// What the file holds: the name of its track (its own name is the one of the file).
    fn content(&self, id: Uuid) -> String {
        self.engine.file_structure(&FileId(id)).unwrap().tracks[0]
            .info
            .name
            .clone()
            .unwrap_or_default()
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
    api::new_file(&mut fx.engine, "fresh", None, None, None, false);
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
    fx.workspace
        .save(&mut fx.engine, &[id], &paths, None)
        .unwrap();
    assert!(path.exists());
    assert!(!fx.workspace.is_dirty(&fx.engine, id));
    assert!(fx.workspace.unlinked(&fx.engine, &[id]).is_empty());
}

#[test]
fn several_files_without_a_place_go_in_a_folder_with_names_that_are_free() {
    let mut fx = Fixture::new();
    fx.write("fresh.gpx", "already there");
    api::new_file(&mut fx.engine, "fresh", None, None, None, false);
    api::new_file(&mut fx.engine, "a/b: c", None, None, None, false);
    api::new_file(&mut fx.engine, "fresh", None, None, None, false);
    let ids = fx.ids();
    let folder = fx.folder.clone();
    fx.workspace
        .save(&mut fx.engine, &ids, &BTreeMap::new(), Some(&folder))
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
    api::select(&mut fx.engine, &[id], SelectMode::Replace);
    assert!(!api::style(&mut fx.engine, Some("#ff0000"), None, None).has_error());
    fx.save(&[id]);
    assert!(fx.reconcile(Some(&[path])).is_none());
    assert!(!fx.status(id).replaced && !fx.status(id).dirty);
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
fn folders_are_made_renamed_and_moved_and_the_open_files_follow() {
    let mut fx = Fixture::new();
    let a = fx.write("a.gpx", "a");
    fx.open_folder();
    let id = fx.ids()[0];
    let root = fx.folder.clone();
    let path_of = |fx: &Fixture| PathBuf::from(fx.status(id).path.unwrap());

    let first = fx.workspace.create_folder(&root, "New folder").unwrap();
    let second = fx.workspace.create_folder(&root, "New folder").unwrap();
    assert_eq!(first, root.join("New folder"));
    assert_eq!(second, root.join("New folder 2"));

    fx.workspace.move_paths(&[a], &first).unwrap();
    assert_eq!(path_of(&fx), first.join("a.gpx"));
    assert!(first.join("a.gpx").exists() && !fx.status(id).dirty);

    let trips = fx.workspace.rename_path(&first, "Trips").unwrap();
    assert_eq!(path_of(&fx), root.join("Trips/a.gpx"));
    // a folder does not go into itself, nor onto something else
    assert!(
        fx.workspace
            .move_paths(std::slice::from_ref(&trips), &trips)
            .is_err()
    );
    assert_eq!(
        fx.workspace.rename_path(&trips, "New folder 2"),
        Err(NAME_TAKEN.to_owned())
    );
    fx.workspace.move_paths(&[trips], &second).unwrap();
    assert_eq!(path_of(&fx), second.join("Trips/a.gpx"));

    // a file keeps its extension
    let closed = fx.write("c.gpx", "c");
    assert_eq!(
        fx.workspace.rename_path(&closed, "d").unwrap(),
        root.join("d.gpx")
    );
    // the open folder and what is not in it are left alone
    assert!(fx.workspace.rename_path(&root, "x").is_err());
    let elsewhere = canonical(&std::env::temp_dir());
    assert!(fx.workspace.rename_path(&elsewhere, "x").is_err());
    assert!(fx.workspace.create_folder(&elsewhere, "x").is_err());
}

#[test]
fn deleted_files_are_closed_unless_they_have_edits() {
    let mut fx = Fixture::new();
    let a = fx.write("a.gpx", "a");
    let b = fx.write("b.gpx", "b");
    fx.open_folder();
    let (id_a, id_b) = (fx.id_named("a"), fx.id_named("b"));
    api::select(&mut fx.engine, &[id_b], SelectMode::Replace);
    assert!(!api::style(&mut fx.engine, Some("#ff0000"), None, None).has_error());

    let outcome = fx
        .workspace
        .delete_paths(&mut fx.engine, &[a.clone(), b.clone()], |paths| {
            paths.iter().for_each(|path| fs::remove_file(path).unwrap());
            Ok(())
        })
        .unwrap();
    assert!(outcome.changed);
    assert_eq!(fx.ids(), [id_b]);
    assert!(!fx.ids().contains(&id_a));
    let status = fx.status(id_b);
    assert!(status.dirty && status.missing);
    assert!(!a.exists() && !b.exists());
}

#[test]
fn the_tree_of_the_folder_shows_folders_first_and_only_gpx_files() {
    let mut fx = Fixture::new();
    fx.write("b.gpx", "b");
    fx.write("A.GPX", "a");
    fx.write("b 10.gpx", "b 10");
    fx.write("b 2.gpx", "b 2");
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
            ("b 2.gpx".to_string(), false),
            ("b 10.gpx".to_string(), false),
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
fn names_are_sorted_by_the_numbers_they_hold() {
    let mut names = vec![
        "track 10",
        "track 2",
        "Track 1",
        "track",
        "track 02b",
        "track 2a",
        "b",
        "A",
    ];
    names.sort_by(|a, b| natural_cmp(a, b).then_with(|| a.cmp(b)));
    assert_eq!(
        names,
        [
            "A",
            "b",
            "track",
            "Track 1",
            "track 2",
            "track 2a",
            "track 02b",
            "track 10",
        ]
    );
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
    assert_eq!(fx.content(id), "theirs");
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
    assert_eq!(fx.content(id), "theirs");
    let status = fx.status(id);
    assert!(!status.dirty && !status.replaced);
    // and it is one undo step
    api::select(&mut fx.engine, &[id], SelectMode::Replace);
    api::undo(&mut fx.engine);
    assert_eq!(fx.content(id), "mine");
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
    assert_eq!(fx.content(id), "back");
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
    assert_eq!(fx.content(id), "changed");
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
    api::new_file(&mut fx.engine, "fresh", None, None, None, false);
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
    api::new_file(&mut fx.engine, "fresh", None, None, None, false);
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
    let result = fx
        .workspace
        .save(&mut fx.engine, &[id], &BTreeMap::new(), None);
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
    fx.workspace.save_as(&mut fx.engine, id, &target).unwrap();
    assert!(fs::read_to_string(&target).unwrap().contains("edited"));
    assert!(fs::read_to_string(a).unwrap().contains(">a<"));
    let status = fx.status(id);
    assert!(!status.dirty);
    assert_eq!(status.path.as_deref(), canonical(&target).to_str());

    // the place of another open file is not available
    let taken = fx.folder.join("b.gpx");
    assert!(fx.workspace.save_as(&mut fx.engine, id, &taken).is_err());
    assert!(!fx.workspace.is_dirty(&fx.engine, other));
}

mod restart {
    use gpx_engine::Persister;

    use super::*;
    use gpx_studio_desktop_lib::store::FileStorage;

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
        workspace.open_files(&mut engine, &gpx_files(&folder), false);
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
