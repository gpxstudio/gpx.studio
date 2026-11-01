//! The storage of the engine on the file system (`store`).

use std::fs;
use std::path::PathBuf;

use gpx_engine::{
    Action, Batch, Command, CommitError, Load, LoadFiles, Persister, Revision, Storage,
};
use gpx_studio_desktop_lib::Engine;
use gpx_studio_desktop_lib::store::FileStorage;
use uuid::Uuid;

fn directory() -> PathBuf {
    std::env::temp_dir().join(format!("gpx-studio-store-{}", Uuid::new_v4()))
}

fn engine_with_a_file() -> Engine {
    let mut engine = Engine::default();
    let data = std::fs::read("../gpx-rs/data/simple.gpx").unwrap();
    engine
        .execute(Action::Edit(Command::LoadFiles(LoadFiles {
            files: vec![Load {
                data: &data,
                name: "simple",
            }],
        })))
        .unwrap();
    engine
}

#[test]
fn keeps_the_files_and_the_settings_between_sessions() {
    let root = directory();
    let engine = engine_with_a_file();
    let order = engine.order().to_vec();

    let storage = FileStorage::open(&root).unwrap();
    pollster::block_on(Persister::default().save(&storage, engine.snapshot())).unwrap();
    pollster::block_on(storage.put_setting("units", "\"metric\"")).unwrap();

    // another session
    let storage = FileStorage::open(&root).unwrap();
    let restored = pollster::block_on(Persister::default().restore(&storage)).unwrap();
    let mut other = Engine::default();
    other.restore(restored);
    assert_eq!(other.order(), order);
    assert_eq!(
        other.file_statistics(&order[0]).unwrap().total_distance,
        engine.file_statistics(&order[0]).unwrap().total_distance
    );
    assert_eq!(storage.settings()["units"], "\"metric\"");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn refuses_a_commit_that_is_not_based_on_the_head() {
    let root = directory();
    let storage = FileStorage::open(&root).unwrap();
    let batch = Batch {
        order: Some(vec![]),
        ..Default::default()
    };
    assert_eq!(pollster::block_on(storage.commit(&batch)), Ok(Revision(1)));
    assert_eq!(
        pollster::block_on(storage.commit(&batch)),
        Err(CommitError::Stale { head: Revision(1) })
    );
    fs::remove_dir_all(root).unwrap();
}
