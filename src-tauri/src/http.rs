// ─── Host-proxied HTTP (the `network` capability) ────────────────────────────
// A single, gated HTTP primitive so modules (e.g. a WebDAV/Nextcloud provider)
// can reach the network without WebView CORS. It does ONE thing — send a request
// and return the response — and NEVER touches the filesystem. A module that wants
// to upload a file reads its bytes itself via `fs.readBytes` (the `fs:read`
// capability) and passes them as the body; a module that wants to save a response
// writes it itself via `fs.*` / `sys.writeTempFile`. That keeps one role per
// command: `network` sends and receives bytes, it does not read or write disk.
//
// Auth is the module's job: it passes a full `Authorization` header — Rust just
// sends the request.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;

/// Cap on a response body we will buffer (base64 roughly doubles this in memory).
/// Guards against a module pulling a multi-GB URL and exhausting memory.
const MAX_RESPONSE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestArgs {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    /// Request body as base64 (raw bytes). The frontend gateway encodes whatever
    /// the module passed (text or a Uint8Array) so binary uploads round-trip.
    pub body_base64: Option<String>,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    /// Response body as base64 (raw bytes). The frontend gateway decodes it to a
    /// Uint8Array and a UTF-8 string so a module can use either.
    pub body_base64: String,
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

/// Drain a ureq response into our serializable shape: status, headers (lowercased
/// names), and the body buffered (capped) and base64-encoded.
fn read_response(resp: ureq::Response) -> Result<HttpResponse, String> {
    use base64::Engine;
    let status = resp.status();

    let mut headers = HashMap::new();
    for name in resp.headers_names() {
        if let Some(value) = resp.header(&name) {
            headers.insert(name.to_lowercase(), value.to_string());
        }
    }

    // Read at most MAX + 1 so we can detect (and reject) an over-cap body.
    let mut buf = Vec::new();
    resp.into_reader()
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut buf)
        .map_err(|e| e.to_string())?;
    if buf.len() as u64 > MAX_RESPONSE_BYTES {
        return Err(format!("Response too large (> {} bytes)", MAX_RESPONSE_BYTES));
    }

    let body_base64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(HttpResponse {
        status,
        headers,
        body_base64,
    })
}

/// Send one HTTP request and return its response. Pure network — no filesystem.
#[tauri::command]
pub fn http_request(req: HttpRequestArgs) -> Result<HttpResponse, String> {
    use base64::Engine;

    let mut request = http_agent()?.request(&req.method, &req.url);
    for (key, value) in &req.headers {
        request = request.set(key, value);
    }

    let result = match &req.body_base64 {
        Some(b64) => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64.as_bytes())
                .map_err(|e| e.to_string())?;
            request.send_bytes(&bytes)
        }
        None => request.call(),
    };

    match result {
        Ok(resp) => read_response(resp),
        // ureq treats non-2xx as an error but still carries the response; surface
        // it as a normal result so the module can read the status + body.
        Err(ureq::Error::Status(_code, resp)) => read_response(resp),
        Err(e) => Err(e.to_string()),
    }
}
