fn main() {
    // On Windows, the dialogs need Common Controls v6, which a binary only gets with a manifest that
    // asks for it: tauri-build gives one to the app, but not to the test binaries, which would stop
    // with STATUS_ENTRYPOINT_NOT_FOUND before running any test. This gives them the same manifest
    // (`-tests` only reaches the binaries of `tests`, hence the tests are there).
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("windows-test.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
    tauri_build::build()
}
