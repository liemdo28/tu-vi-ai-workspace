const PBKDF2_ITERATIONS = 120000;

export function requireDb(env) {
  if (!env.DB) {
    throw new Error("Thiếu binding DB. Hãy cấu hình Cloudflare D1 binding tên `DB`.");
  }
  if (!env.AUTH_SECRET) {
    throw new Error("Thiếu AUTH_SECRET trong biến môi trường.");
  }
  return env.DB;
}

export async function initSchema(db) {
  await db
    .batch([
      db.prepare(
        "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL)"
      ),
      db.prepare(
        "CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)"
      )
    ])
    .catch(() => {});
}

export async function hashPassword(password, saltText) {
  const salt = utf8(saltText || crypto.randomUUID());
  const key = await crypto.subtle.importKey("raw", utf8(password), { name: "PBKDF2" }, false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );
  return {
    hash: base64url(new Uint8Array(bits)),
    salt: text(salt)
  };
}

export async function verifyPassword(password, hash, salt) {
  const out = await hashPassword(password, salt);
  return safeEqual(out.hash, hash);
}

export async function signToken(payloadObj, secret, ttlSeconds = 3600 * 24 * 14) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...payloadObj,
    iat: now,
    exp: now + ttlSeconds
  };
  const data = base64url(utf8(JSON.stringify(payload)));
  const signature = await hmacSign(data, secret);
  return `${data}.${signature}`;
}

export async function verifyToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = await hmacSign(data, secret);
  if (!safeEqual(sig, expected)) return null;
  const payload = JSON.parse(text(base64urlDecode(data)));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;
  return payload;
}

export function bearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function utf8(v) {
  return new TextEncoder().encode(String(v || ""));
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(data));
  return base64url(new Uint8Array(sig));
}

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64urlDecode(value) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replaceAll("-", "+").replaceAll("_", "/") + pad;
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
