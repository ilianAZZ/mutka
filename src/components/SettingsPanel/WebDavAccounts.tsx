import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";

// Manager for the core.webdav module's accounts. Account metadata lives in the
// module's config namespace (localStorage); each PASSWORD lives in the macOS
// Keychain (the same service the `secrets` capability uses). On change it emits
// "webdav:accounts-changed" so the module re-renders its sidebar entries.
//
// This is settings UI coupled to core.webdav (hence the direct invoke + the
// shared key/service constants), not a generic component.

interface Account { id: string; name: string; url: string; username: string }
interface Draft { id: string | null; name: string; url: string; username: string; password: string }

const ACCOUNTS_KEY = "macows.modcfg.core.webdav.accounts";
const SECRETS_SERVICE = "macows.core.webdav";
const EMPTY_DRAFT: Draft = { id: null, name: "", url: "", username: "", password: "" };

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch { return []; }
}

function saveAccounts(list: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  EventBus.emit(Events.Webdav.accountsChanged);
}

export function WebDavAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [draft, setDraft] = useState<Draft | null>(null);

  const upd = (key: keyof Draft, value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const remove = useCallback(async (id: string) => {
    const next = loadAccounts().filter((a) => a.id !== id);
    saveAccounts(next);
    setAccounts(next);
    try { await invoke("secret_delete", { service: SECRETS_SERVICE, account: id }); }
    catch (err) { console.error("[WebDavAccounts] secret_delete:", err); }
  }, []);

  const save = useCallback(async () => {
    if (!draft || !draft.url.trim()) return;
    const id = draft.id ?? crypto.randomUUID();
    const account: Account = {
      id,
      name: draft.name.trim() || draft.username.trim() || "WebDAV",
      url: draft.url.trim(),
      username: draft.username.trim(),
    };
    const existing = loadAccounts();
    const next = draft.id ? existing.map((a) => (a.id === id ? account : a)) : [...existing, account];
    // Set the password only when provided (blank on edit = keep the existing one).
    if (draft.password) {
      try { await invoke("secret_set", { service: SECRETS_SERVICE, account: id, password: draft.password }); }
      catch (err) { console.error("[WebDavAccounts] secret_set:", err); }
    }
    saveAccounts(next);
    setAccounts(next);
    setDraft(null);
  }, [draft]);

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h2 className="settings-section-title">WebDAV Accounts</h2>
        {!draft && <button className="keybind-btn" onClick={() => setDraft({ ...EMPTY_DRAFT })}>Add</button>}
      </div>
      <p className="settings-hint">
        Passwords are kept in the macOS Keychain. For Nextcloud the URL is
        https://host/remote.php/dav/files/USERNAME/
      </p>

      {!draft && accounts.length === 0 && <p className="settings-hint">No accounts yet.</p>}

      {!draft && accounts.map((a) => (
        <div key={a.id} className="account-row">
          <div className="account-info">
            <span className="account-name">{a.name}</span>
            <span className="account-sub">{a.username ? `${a.username} · ` : ""}{a.url}</span>
          </div>
          <button className="keybind-btn" onClick={() => setDraft({ id: a.id, name: a.name, url: a.url, username: a.username, password: "" })}>Edit</button>
          <button className="keybind-reset" onClick={() => remove(a.id)} title="Remove account">✕</button>
        </div>
      ))}

      {draft && (
        <div className="account-form">
          <label className="settings-field">
            <span className="settings-field-label">Name</span>
            <input className="settings-input" type="text" placeholder="My Nextcloud" value={draft.name} onChange={(e) => upd("name", e.target.value)} />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Server URL</span>
            <input className="settings-input" type="url" placeholder="https://host/remote.php/dav/files/you/" value={draft.url} onChange={(e) => upd("url", e.target.value)} />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Username</span>
            <input className="settings-input" type="text" value={draft.username} onChange={(e) => upd("username", e.target.value)} />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">{draft.id ? "Password (blank = keep current)" : "App password"}</span>
            <input className="settings-input" type="password" value={draft.password} onChange={(e) => upd("password", e.target.value)} />
          </label>
          <div className="account-form-actions">
            <button className="keybind-btn" onClick={() => setDraft(null)}>Cancel</button>
            <button className="keybind-btn keybind-btn--primary" onClick={save}>Save</button>
          </div>
        </div>
      )}
    </section>
  );
}
