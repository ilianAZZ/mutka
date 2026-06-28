use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliArgs {
    pub path: Option<String>,
    pub picker: bool,
    pub run: Option<String>,
    pub list_actions: bool,
}

/// Return the CLI args parsed at launch.
#[tauri::command]
pub fn get_cli_args(args: State<'_, CliArgs>) -> CliArgs {
    args.inner().clone()
}

/// Write a line to stdout (visible when launched from a terminal).
#[tauri::command]
pub fn cli_output(text: String) -> Result<(), String> {
    println!("{}", text);
    Ok(())
}

/// Exit the process with a given code (used after --picker completes).
#[tauri::command]
pub fn cli_exit(code: i32) -> Result<(), String> {
    std::process::exit(code);
}
