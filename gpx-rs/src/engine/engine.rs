// TODO license in every file

use std::rc::Rc;

use js_sys::{Float64Array, Function, Int32Array};
use uuid::Uuid;

use crate::{
    Command, File, FileId, Selection, Stack, StackEntry, StatisticsBuffer, StatisticsCache, parse,
};

extern crate console_error_panic_hook;

#[derive(Debug, Default)]
pub struct Engine {
    stack: Stack,
    selection: Selection,
    statistics_cache: StatisticsCache,
    statistics_buffer: StatisticsBuffer,
}

impl Engine {
    pub fn total_distance(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.total_distance) }
    }

    pub fn moving_distance(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.moving_distance) }
    }

    pub fn total_time(&self) -> Int32Array {
        unsafe { Int32Array::view(&self.statistics_buffer.total_time) }
    }

    pub fn moving_time(&self) -> Int32Array {
        unsafe { Int32Array::view(&self.statistics_buffer.moving_time) }
    }

    pub fn speed(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.speed) }
    }

    pub fn elevation_gain(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.elevation_gain) }
    }

    pub fn elevation_loss(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.elevation_loss) }
    }

    pub fn slope(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.slope) }
    }

    pub fn slope_segment_slope(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.slope_segment_slope) }
    }

    pub fn slope_segment_distance(&self) -> Float64Array {
        unsafe { Float64Array::view(&self.statistics_buffer.slope_segment_distance) }
    }

    pub fn create_file(&mut self, name: &str) -> bool {
        self.event_loop(|entry| {
            let mut file = File::default();
            file.info.name = name.to_string();
            entry.insert(file.id, Rc::new(file));
            true
        })
    }

    pub fn load_file(&mut self, data: &[u8]) -> bool {
        self.event_loop(|entry| {
            if let Ok(file) = parse(data) {
                entry.insert(file.id, Rc::new(file));
                true
            } else {
                false
            }
        })
    }

    pub fn delete_file(&mut self, id: &[u8]) -> bool {
        self.event_loop(|entry| {
            if let Ok(id) = Uuid::from_slice(id) {
                let id = FileId(id);
                entry.remove(&id).is_some()
            } else {
                false
            }
        })
    }

    /// Single entry point for every user action coming from the frontend.
    pub fn execute(&mut self, command: Command) -> bool {
        match command {
            Command::New { name } => self.create_file(name),
            Command::Load { data } => self.load_file(data),
            Command::Delete
            | Command::DeleteAll
            | Command::Duplicate
            | Command::Metadata { .. }
            | Command::Style { .. }
            | Command::NewTrack
            | Command::NewTrackSegment
            | Command::Reverse
            | Command::Append { .. }
            | Command::Replace { .. }
            | Command::NewWaypoint { .. }
            | Command::MoveWaypoint { .. }
            | Command::Crop { .. }
            | Command::Split { .. }
            | Command::Time
            | Command::Merge { .. }
            | Command::Extract
            | Command::Elevation { .. }
            | Command::Clean { .. }
            | Command::Undo
            | Command::Redo
            | Command::Select { .. }
            | Command::AddSelect { .. }
            | Command::SelectAll => todo!("command not implemented yet"),
        }
    }

    fn event_loop<F>(&mut self, f: F) -> bool
    where
        F: FnOnce(&mut StackEntry) -> bool,
    {
        if let Some(diff) = self.stack.create_and_push_next(f) {
            self.selection.select(diff.added[0]);
            self.statistics_cache.update(self.stack.current());
            self.statistics_buffer.update(
                &self
                    .statistics_cache
                    .get(self.stack.current(), &self.selection),
            );
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Read};

    use super::*;

    #[test]
    fn test_load_file() {
        let mut engine = Engine::default();

        let mut f = File::open("data/simple.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);

        engine.load_file(data.as_bytes());

        assert_eq!(engine.statistics_buffer.total_distance.len(), 80);
    }
}
