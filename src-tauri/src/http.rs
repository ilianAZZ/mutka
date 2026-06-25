// ─── Host-proxied HTTP (the `net` capability) ────────────────────────────────
// A thin, gated HTTP bridge so modules (e.g. a WebDAV/Nextcloud provider) can
// reach the network without WebView CORS. Auth is the module's job: it passes a
// full `Authorization` header — Rust just sends the request.

use std::fs;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestArgs {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

/// Build a ureq Agent with an explicit native-TLS connector. The default agent
/// has NO TLS backend when rustls is disabled, so every HTTPS request must go
/// through an agent built here.
fn http_agent() -> Result<ureq::Agent, String> {
    let connector = native_tls::TlsConnector::new().map_err(|e| e.to_string())?;
    Ok(ureq::AgentBuilder::new()
        .tls_connector(std::sync::Arc::new(connector))
        .build())
}

#[tauri::command]
pub fn http_request(req: HttpRequestArgs) -> Result<HttpResponse, String> {
    let mut request = http_agent()?.request(&req.method, &req.url);
    for (key, value) in &req.headers {
        request = request.set(key, value);
    }

    let result = match &req.body {
        Some(body) => request.send_string(body),
        None => request.call(),
    };

    match result {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.into_string().map_err(|e| e.to_string())?;
            Ok(HttpResponse { status, body })
        }
        // ureq treats non-2xx as an error but still carries the response.
        Err(ureq::Error::Status(code, resp)) => {
            let body = resp.into_string().unwrap_or_default();
            Ok(HttpResponse { status: code, body })
        }
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpDownloadArgs {
    pub url: String,
    pub filename: String,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpUploadArgs {
    pub local_path: String,
    pub url: String,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
}

/// PUT a local file's bytes to a URL (upload). Bytes never leave Rust.
#[tauri::command]
pub fn http_upload(req: HttpUploadArgs) -> Result<(), String> {
    let bytes = fs::read(&req.local_path).map_err(|e| e.to_string())?;
    let mut request = http_agent()?.put(&req.url);
    for (key, value) in &req.headers {
        request = request.set(key, value);
    }
    match request.send_bytes(&bytes) {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, _)) if (200..300).contains(&code) => Ok(()),
        Err(ureq::Error::Status(code, resp)) => {
            Err(format!("HTTP {}: {}", code, resp.into_string().unwrap_or_default()))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// GET a URL into a file in the system temp dir, returning the local path.
#[tauri::command]
pub fn http_download(req: HttpDownloadArgs) -> Result<String, String> {
    let mut request = http_agent()?.get(&req.url);
    for (key, value) in &req.headers {
        request = request.set(key, value);
    }
    let resp = request.call().map_err(|e| e.to_string())?;

    let dest = std::env::temp_dir().join("mutka-cache").join(&req.filename);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut reader = resp.into_reader();
    let mut file = fs::File::create(&dest).map_err(|e| e.to_string())?;
    std::io::copy(&mut reader, &mut file).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}
