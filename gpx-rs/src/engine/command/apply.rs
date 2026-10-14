use std::fmt;

use crate::State;

/// The effect of a command on the engine state.
///
/// Each command is a small struct holding its arguments, with its effect implemented in its
/// own file. Effects are built from the reusable patterns in `pattern/`.
pub trait Apply {
    fn apply(self, state: &mut State) -> Result<(), CommandError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandError {
    /// The command would not change anything.
    NothingToDo,
    /// The input data could not be parsed.
    InvalidData(String),
}

impl fmt::Display for CommandError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NothingToDo => write!(f, "nothing to do"),
            Self::InvalidData(err) => write!(f, "invalid data: {err}"),
        }
    }
}

impl std::error::Error for CommandError {}
