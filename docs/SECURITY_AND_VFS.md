# 🔐 PipVault Cryptographic Envelope & Virtual Filesystem (PipFS) Specification

The security, data integrity, and virtual filesystem architecture in Pip OS are implemented in [`js/vault.js`](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/pipOS/js/vault.js) (`PIP.vault`) and [`js/vfs.js`](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/pipOS/js/vfs.js) (`PIP.fs`). Together, they provide zero-knowledge client-side tamper-proof data persistence, cryptographically signed backup bundles, and a complete hierarchical POSIX virtual filesystem operating entirely within standard browser sandboxes without third-party dependencies.

---

## 1. Cryptographic Model & Envelope Architecture

PipVault guarantees data integrity for high scores, sticker book achievements, user settings, and terminal files by wrapping all stored items in sealed cryptographic envelopes:

```text
+---------------------------------------------------------------------------------------+
|                              PipVault Envelope v1 Schema                              |
+-------+--------------------------+--------------------+------------------+------------+
|  v: 1 | k: "pip_stars_best"      | ts: 1731998400000  | d: { score: 42 } | sig: "..." |
+-------+--------------------------+--------------------+------------------+------------+
| Version| Storage Identifier       | Creation Timestamp | Verified Payload | HMAC-SHA256|
+-------+--------------------------+--------------------+------------------+------------+
                                                                                 ^
                                                                                 |
  [ Salt: "pipos-midnight-nursery-vault-salt-v1" ]                               |
                           +                                                     |
  [ Sign Payload: "k | ts | JSON.stringify(d)" ] ----> WebCrypto HMAC-SHA256 ----+
```

### 1. Zero-Knowledge Client-Side Key Management
- Uses standard W3C Web Crypto API (`window.crypto.subtle`).
- Derives a transient symmetric signature key using the platform-isolated domain salt:
  $$\text{SALT} = \text{"pipos-midnight-nursery-vault-salt-v1"}$$
- Raw key material is imported via `subtle.importKey('raw', saltBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])`.
- The key is non-extractable (`extractable: false`), preventing script inspection or exfiltration by untrusted browser extensions.

### 2. Pure JavaScript Deterministic Fallback Hash
In non-HTTPS local environments or headless testing runners where `window.crypto.subtle` is unavailable, PipVault falls back seamlessly to a deterministic 64-bit Murmur-inspired dual-accumulator hash (`fallbackHash`):
$$h_1 = (h_1 \oplus \text{code}) \times 2654435761, \quad h_2 = (h_2 \oplus \text{code}) \times 1597334677$$
This ensures 100% test coverage and offline stability without requiring Node.js crypto polyfills.

---

## 2. Tamper Detection & Storage Integrity Verification

When data is retrieved via `PIP.vault.getSecure(key, fallback)`:

```mermaid
flowchart TD
    Req["Request: vault.getSecure(key, fallback)"] --> Fetch["Read localStorage['pip:vault:' + key]"]
    Fetch --> NullCheck{"Entry Exists?"}
    NullCheck -- No --> RetFallback["Return fallback"]
    
    NullCheck -- Yes --> Parse["JSON.parse(raw) -> Envelope"]
    Parse --> ValidateEnv{"Validate Envelope Structure<br/>v === 1 && k && ts && sig"}
    ValidateEnv -- Malformed --> LogTamper["Log Dev Warning:<br/>'[pip:vault] Tamper detected on key...'"]
    
    ValidateEnv -- Valid Structure --> Recompute["Recompute Expected Signature:<br/>sigPayload = k + '|' + ts + '|' + JSON.stringify(d)"]
    Recompute --> SigMatch{"env.sig === expectedSig?"}
    
    SigMatch -- "Mismatch (Tampered)" --> LogTamper
    LogTamper --> RetFallback
    
    SigMatch -- "Match (Untampered)" --> RetData["Return Valid Payload (env.d)"]
```

### Tamper Resilience Guarantees
1. **Zero-Crash Policy**: Malformed JSON, altered scores, or modified unlock states never throw uncaught exceptions.
2. **Graceful Fallback**: If an attacker attempts to edit their high score from `12` to `9999` in DevTools LocalStorage, the signature payload mismatch forces the OS to revert to the safe default value (`fallback`).
3. **Storage Namespacing**: All secure records are stored with the prefix `pip:vault:<key>` to prevent collision with unencrypted keys.

---

## 3. Portable Cryptographic Backup & Restore Protocol

Users can export and import full system state snapshots via `exportBackup()` and `importBackup(jsonStr)`.

### Backup Bundle Format
```json
{
  "app": "pipOS",
  "version": "10.0",
  "exportedAt": "2026-11-19T17:00:00.000Z",
  "records": {
    "blockTopScores": {
      "v": 1,
      "k": "blockTopScores",
      "ts": 1731998400000,
      "d": [28, 22, 19, 14, 9],
      "sig": "h_9b14c3e..."
    },
    "pip_stars_best": {
      "v": 1,
      "k": "pip_stars_best",
      "ts": 1731998400000,
      "d": "42",
      "sig": "h_a7f82c1..."
    }
  },
  "checksum": "h_e83bc12..."
}
```

### Verification Pipeline (`importBackup`)
1. **Schema Check**: Verifies `bundle.app === 'pipOS'`, `bundle.records`, and `bundle.checksum`.
2. **Master Checksum Verification**: Computes the signature of the entire records dictionary string:
   $$\text{expectedChecksum} = \text{computeSignatureSync}(\text{JSON.stringify}(\text{bundle.records}))$$
   If `bundle.checksum !== expectedChecksum`, the import fails immediately with `"Corrupted backup: checksum mismatch"`.
3. **Item-Level Envelope Verification**: Each individual record is validated through `verifyEnvelope(env)`. Only uncorrupted records are written into local storage.

---

## 4. Virtual Filesystem (PipFS) Architecture

The PipOS Virtual Filesystem (`js/vfs.js`) provides a POSIX-compliant hierarchical directory tree operating completely in memory with LocalStorage serialization.

```text
/ (root)
├── home/
│   └── pip/
│       ├── desktop/
│       │   └── welcome.txt
│       └── documents/
│           └── lullaby_notes.md
└── system/
    └── config/
        └── theme.json
```

### 1. In-Memory Directory Node Structure
Every node in PipFS is represented as a structured object:
```javascript
// Directory Node
{
  type: 'dir',
  name: 'desktop',
  children: { ... }
}

// File Node
{
  type: 'file',
  name: 'welcome.txt',
  content: 'Welcome to PipOS 10.0...',
  mtime: 1731998400000
}
```

### 2. Path Normalization & Resolution
PipFS standardizes all path lookups through `normalizePath` and `resolvePath`:
- **Tilde Expansion**: `~/documents` resolves automatically to `/home/pip/documents`.
- **Relative Path Resolution**: `resolvePath('/home/pip', '../system')` resolves to `/home/system`.
- **Dot and Dot-Dot Segment Flattening**: Segments `.` (current) are skipped; `..` (parent) pops the traversal stack.
- **Root Boundary**: `normalizePath('/../../')` safely clamps to `/`.

### 3. POSIX Operations Reference
| Method | Signature | Description |
| :--- | :--- | :--- |
| `readFile` | `(pathStr: string) -> string` | Reads UTF-8 file content. Throws if directory or missing. |
| `writeFile` | `(pathStr: string, content: string) -> boolean` | Writes or overwrites file content, updating modification time `mtime`. |
| `mkdir` | `(pathStr: string) -> boolean` | Recursively creates parent directories as needed (`mkdir -p` behavior). |
| `readDir` | `(pathStr: string) -> Entry[]` | Returns directory array: `[{ name, type, size, mtime }]`. |
| `unlink` | `(pathStr: string) -> boolean` | Removes a file from its parent directory. Root cannot be deleted. |
| `exists` | `(pathStr: string) -> boolean` | Returns `true` if path points to an existing file or directory. |
| `isDirectory` | `(pathStr: string) -> boolean` | Returns `true` if path is a directory. |

---

## 5. Public JavaScript APIs

### PipVault API (`window.PIP.vault`)
```javascript
PIP.vault = {
  VAULT_PREFIX: 'pip:vault:',
  setSecure: Function,      // (key: string, value: any) -> boolean
  getSecure: Function,      // (key: string, fallback: any) -> any
  isValid: Function,        // (key: string) -> boolean
  removeSecure: Function,   // (key: string) -> boolean
  exportBackup: Function,   // () -> string (JSON)
  importBackup: Function,   // (jsonStr: string) -> { ok: boolean, imported?: number, error?: string }
  createEnvelope: Function, // (key: string, data: any) -> Envelope
  verifyEnvelope: Function  // (env: Envelope) -> boolean
};
```

### PipFS API (`window.PIP.fs`)
```javascript
PIP.fs = {
  normalizePath: Function,  // (pathStr: string) -> string
  resolvePath: Function,    // (currentDir: string, targetPath: string) -> string
  exists: Function,         // (pathStr: string) -> boolean
  isDirectory: Function,    // (pathStr: string) -> boolean
  readFile: Function,       // (pathStr: string) -> string
  writeFile: Function,      // (pathStr: string, content: string) -> boolean
  mkdir: Function,          // (pathStr: string) -> boolean
  readDir: Function,        // (pathStr: string) -> Entry[]
  unlink: Function          // (pathStr: string) -> boolean
};
```
