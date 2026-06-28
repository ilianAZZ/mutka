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
    /// The two network tiers the calling module holds, set by the gateway from the
    /// module's authoritative manifest (NOT module-controlled). `allow_public` =
    /// `network:public` (HTTPS to a public domain); `allow_local` = `network:local`
    /// (IP addresses or localhost). The URL is classified below and rejected unless
    /// the matching tier is granted.
    #[serde(default)]
    pub allow_public: bool,
    #[serde(default)]
    pub allow_local: bool,
}

fn default_method() -> String {
    "GET".to_string()
}

/// Reject a URL the calling module isn't permitted to reach. This is the SSRF /
/// network-tier boundary, enforced in Rust (the trusted side):
///
/// - host is a **private IP range** (RFC1918 / loopback / link-local / ULA / …) or
///   `localhost` → the `network:local` tier (http or https);
/// - host is a **public domain** (a dot + an alphabetic TLD) → the `network:public`
///   tier, which additionally REQUIRES https so credentials/data can't be read in
///   transit;
/// - anything else — a **public IP literal**, a plaintext-http public domain, a
///   single-label host, an unknown scheme — is refused. Public access must be by
///   https domain; local access must be by private IP / localhost.
///
/// Residual: `network:public` validates the hostname, not the resolved IP, so a
/// public domain that resolves to a private address (DNS rebinding) is not caught
/// — we deliberately do not pin IPs here. See docs/safety.md.
fn check_url_allowed(url: &str, allow_public: bool, allow_local: bool) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("Unsupported URL scheme: {}", scheme));
    }
    let is_https = scheme == "https";

    match parsed.host() {
        Some(url::Host::Ipv4(ip)) => classify_ip(std::net::IpAddr::V4(ip), allow_local),
        Some(url::Host::Ipv6(ip)) => classify_ip(std::net::IpAddr::V6(ip), allow_local),
        Some(url::Host::Domain(host)) => {
            if host.eq_ignore_ascii_case("localhost") {
                return if allow_local {
                    Ok(())
                } else {
                    Err("This module lacks the \"network:local\" permission (localhost).".into())
                };
            }
            if is_public_domain(host) {
                if !allow_public {
                    return Err("This module lacks the \"network:public\" permission.".into());
                }
                if !is_https {
                    return Err("\"network:public\" requires https (refusing plaintext http to a public host).".into());
                }
                Ok(())
            } else {
                Err(format!("Host \"{}\" is not a public domain or a private IP / localhost.", host))
            }
        }
        None => Err("URL has no host.".into()),
    }
}

/// An IP literal is reachable only via `network:local`, and only if it is a PRIVATE
/// address — a public IP is refused outright (public access must go through a domain).
fn classify_ip(ip: std::net::IpAddr, allow_local: bool) -> Result<(), String> {
    if !is_private_ip(&ip) {
        return Err(format!(
            "Public IP address {} is not allowed — reach public hosts by https domain (network:public).",
            ip
        ));
    }
    if allow_local {
        Ok(())
    } else {
        Err("This module lacks the \"network:local\" permission (private IP address).".into())
    }
}

/// Whether an IP is in a private / non-public range: RFC1918, loopback, link-local,
/// CGNAT, unspecified/broadcast (v4); loopback, unspecified, unique-local (fc00::/7)
/// and link-local (fe80::/10) for v6, plus any IPv4-mapped v6 that wraps a private v4.
fn is_private_ip(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                // 100.64.0.0/10 carrier-grade NAT
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0xc0) == 0x40)
        }
        std::net::IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00 // unique local fc00::/7
                || (v6.segments()[0] & 0xffc0) == 0xfe80 // link local  fe80::/10
                || v6
                    .to_ipv4_mapped()
                    .map(|m| is_private_ip(&std::net::IpAddr::V4(m)))
                    .unwrap_or(false)
        }
    }
}

/// A heuristic "looks like a public domain": at least two labels and a final label
/// that is an alphabetic TLD (≥2 chars). Not a full Public Suffix List check, but
/// enough to separate `example.com` from `localhost` / a bare hostname / an IP.
fn is_public_domain(host: &str) -> bool {
    let host = host.trim_end_matches('.');
    let labels: Vec<&str> = host.split('.').collect();
    if labels.len() < 2 {
        return false;
    }
    match labels.last() {
        Some(tld) => tld.len() >= 2 && tld.chars().all(|c| c.is_ascii_alphabetic()),
        None => false,
    }
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
/// through an agent built here. Auto-redirects are DISABLED (`.redirects(0)`): a
/// 3xx is handed back to the caller as-is, never followed. Following would fetch a
/// redirect target that was never permission-checked (a `network:public` request
/// could be bounced to a private/metadata host). A module that wants to follow a
/// redirect re-requests the `Location` itself, which is validated again.
fn http_agent() -> Result<ureq::Agent, String> {
    let connector = native_tls::TlsConnector::new().map_err(|e| e.to_string())?;
    Ok(ureq::AgentBuilder::new()
        .tls_connector(std::sync::Arc::new(connector))
        .redirects(0)
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
/// One request, one response: redirects are NOT followed (the agent has
/// `.redirects(0)`), so a 3xx is returned to the module as-is. That keeps the URL
/// the module asked for the only one ever fetched, all of it tier-checked here.
#[tauri::command]
pub fn http_request(req: HttpRequestArgs) -> Result<HttpResponse, String> {
    use base64::Engine;

    check_url_allowed(&req.url, req.allow_public, req.allow_local)?;

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
        // ureq treats non-2xx (incl. a not-followed 3xx) as an error but still
        // carries the response; surface it so the module reads the status + body.
        Err(ureq::Error::Status(_code, resp)) => read_response(resp),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::{check_url_allowed, is_public_domain};

    // (allow_public, allow_local) shorthands.
    const PUBLIC_ONLY: (bool, bool) = (true, false);
    const LOCAL_ONLY: (bool, bool) = (false, true);
    const BOTH: (bool, bool) = (true, true);
    const NONE: (bool, bool) = (false, false);

    fn allowed(url: &str, tiers: (bool, bool)) -> bool {
        check_url_allowed(url, tiers.0, tiers.1).is_ok()
    }

    #[test]
    fn public_https_needs_public_tier() {
        assert!(allowed("https://api.github.com/x", PUBLIC_ONLY));
        assert!(allowed("https://example.co.uk", PUBLIC_ONLY));
        assert!(!allowed("https://api.github.com/x", LOCAL_ONLY));
        assert!(!allowed("https://api.github.com/x", NONE));
    }

    #[test]
    fn public_tier_enforces_https() {
        // A public host over plaintext http is refused even with the public tier.
        assert!(!allowed("http://example.com", PUBLIC_ONLY));
        assert!(!allowed("http://example.com", BOTH));
    }

    #[test]
    fn private_ip_and_localhost_are_local_tier() {
        // Private ranges + localhost, over http OR https, need network:local.
        assert!(allowed("http://127.0.0.1:8080/x", LOCAL_ONLY));
        assert!(allowed("https://127.0.0.1", LOCAL_ONLY));
        assert!(allowed("http://192.168.1.10", LOCAL_ONLY));
        assert!(allowed("http://10.0.0.5", LOCAL_ONLY));
        assert!(allowed("http://172.16.3.4", LOCAL_ONLY));
        assert!(allowed("http://localhost:3000", LOCAL_ONLY));
        assert!(allowed("http://[::1]:9000", LOCAL_ONLY)); // IPv6 loopback
        // ...and are refused for a public-only module.
        assert!(!allowed("http://127.0.0.1:8080/x", PUBLIC_ONLY));
        assert!(!allowed("http://localhost", PUBLIC_ONLY));
    }

    #[test]
    fn public_ip_literals_are_refused() {
        // A public IP is neither tier — public access must be by https domain.
        assert!(!allowed("https://8.8.8.8", BOTH));
        assert!(!allowed("http://93.184.216.34", BOTH));
        assert!(!allowed("https://[2606:4700:4700::1111]", BOTH));
    }

    #[test]
    fn ssrf_targets_need_local_tier_not_public() {
        // The cloud metadata endpoint is link-local (private) → local-tier, so
        // network:public alone cannot reach it.
        assert!(!allowed("http://169.254.169.254/latest/meta-data/", PUBLIC_ONLY));
        assert!(allowed("http://169.254.169.254/latest/meta-data/", LOCAL_ONLY));
    }

    #[test]
    fn bare_hostnames_and_bad_schemes_are_refused() {
        assert!(!allowed("https://intranet", BOTH)); // single-label, no TLD
        assert!(!allowed("ftp://example.com", BOTH)); // unsupported scheme
        assert!(!allowed("file:///etc/passwd", BOTH));
        assert!(!allowed("not a url", BOTH));
    }

    #[test]
    fn public_domain_heuristic() {
        assert!(is_public_domain("example.com"));
        assert!(is_public_domain("a.b.example.io"));
        assert!(is_public_domain("example.com.")); // trailing dot tolerated
        assert!(!is_public_domain("localhost"));
        assert!(!is_public_domain("intranet"));
        assert!(!is_public_domain("example.123")); // numeric TLD
    }
}
