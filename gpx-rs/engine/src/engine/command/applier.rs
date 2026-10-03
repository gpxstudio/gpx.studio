use crate::{File, State, parse, produce, update_each_selected_file};

pub fn create_file(state: &mut State, name: &str) -> Result<(), String> {
    produce(state, |_| {
        let mut file = File::default();
        file.info.name = name.to_owned();
        vec![file]
    });
    Ok(())
}

pub fn load_file(state: &mut State, data: &[u8]) -> Result<(), String> {
    let file = parse(data).map_err(|err| err.to_string())?;
    produce(state, |_| vec![file]);
    Ok(())
}

pub fn update_metadata(state: &mut State, name: &str, desc: &str) -> Result<(), String> {
    update_each_selected_file(state, &mut |file| {
        let mut next = (*file).clone();
        next.info.name = name.to_owned();
        next.info.desc = Some(desc.to_owned());
        next
    });
    Ok(())
}
