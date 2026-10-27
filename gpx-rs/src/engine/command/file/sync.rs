use std::rc::Rc;

use crate::{Apply, CommandError, FileId, Load, State};

/// A file that comes from the outside (the file system), under the identity it has here.
#[derive(Debug)]
pub struct ExternalFile<'a> {
    pub id: FileId,
    pub data: &'a [u8],
    /// Name of the file when the data has none (the name of the file on the disk, without its
    /// extension).
    pub name: &'a str,
}

/// Brings changes of the files from the outside in, as a single command (one undo step): the files
/// that are given replace the ones of the same id (which stay where they are in the order, and keep
/// their id), or are added at the end if there are none; the ones to `remove` are deleted.
///
/// Unlike [`crate::LoadFiles`], the selection is left alone (what it holds of a file that was
/// replaced or deleted is dropped by the engine afterwards, as with any edit).
///
/// The files that cannot be read are skipped, and the files that are here stay as they are. It is an
/// error when nothing could be done.
#[derive(Debug, Default)]
pub struct SyncFiles<'a> {
    pub files: Vec<ExternalFile<'a>>,
    pub remove: Vec<FileId>,
}

impl Apply for SyncFiles<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let mut changed = false;
        let mut first_error = None;
        for external in self.files {
            let load = Load {
                data: external.data,
                name: external.name,
            };
            match load.parse(state.categories) {
                Ok(mut file) => {
                    file.id = external.id;
                    if state.files.insert(external.id, Rc::new(file)).is_none() {
                        state.order.0.push(external.id);
                    }
                    changed = true;
                }
                Err(error) => {
                    first_error.get_or_insert(error);
                }
            }
        }
        for id in self.remove {
            if state.files.remove(&id).is_some() {
                state.order.0.retain(|other| *other != id);
                changed = true;
            }
        }
        if changed {
            Ok(())
        } else {
            Err(first_error.unwrap_or(CommandError::NothingToDo))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;
    use crate::{New, Selection};

    use super::*;

    const GPX: &[u8] = br#"<gpx version="1.1"><metadata><name>from disk</name></metadata></gpx>"#;

    fn new_file(fx: &mut Fixture, name: &str) -> FileId {
        New {
            name,
            trackpoint: None,
            route: false,
        }
        .apply(&mut fx.state())
        .unwrap();
        *fx.selected_files().iter().next().unwrap()
    }

    fn external(id: FileId) -> ExternalFile<'static> {
        ExternalFile {
            id,
            data: GPX,
            name: "name",
        }
    }

    #[test]
    fn test_sync_replaces_a_file_in_place() {
        let mut fx = Fixture::default();
        let first = new_file(&mut fx, "first");
        let second = new_file(&mut fx, "second");
        SyncFiles {
            files: vec![external(first)],
            remove: vec![],
        }
        .apply(&mut fx.state())
        .unwrap();
        assert_eq!(fx.order.0, [first, second]);
        // named as the data says, the name outside is only for a file that has none
        assert_eq!(fx.files[&first].info.name, "from disk");
        assert_eq!(fx.files[&first].id, first);
        // the selection is not changed
        assert_eq!(fx.selected_files(), [second].into());
    }

    #[test]
    fn test_sync_adds_and_removes_files() {
        let mut fx = Fixture::default();
        let first = new_file(&mut fx, "first");
        let added = FileId::default();
        SyncFiles {
            files: vec![external(added)],
            remove: vec![first],
        }
        .apply(&mut fx.state())
        .unwrap();
        assert_eq!(fx.order.0, [added]);
        assert!(!fx.files.contains_key(&first));
        // what was selected is gone
        assert!(matches!(fx.selection, Selection::File { .. }));
    }

    #[test]
    fn test_sync_with_nothing_to_do_or_invalid_data_is_an_error() {
        let mut fx = Fixture::default();
        assert_eq!(
            SyncFiles::default().apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        let invalid = SyncFiles {
            files: vec![ExternalFile {
                id: FileId::default(),
                data: b"<gpx><trk></gpx>",
                name: "x",
            }],
            remove: vec![],
        };
        assert!(matches!(
            invalid.apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        assert!(fx.files.is_empty());
    }
}
