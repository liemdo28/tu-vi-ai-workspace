import {
  bearerToken,
  hashPassword,
  initSchema,
  json,
  requireDb,
  signToken
} from "../_db.js";

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env);
    await initSchema(db);

    const body = await request.json().catch(() => ({}));
    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");
    const displayName = clean(body.display_name || body.displayName || "Người dùng");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Email không hợp lệ." }, 400);
    }
    if (password.length < 8) {
      return json({ ok: false, error: "Mật khẩu tối thiểu 8 ký tự." }, 400);
    }

    const existed = await db
      .prepare("SELECT id FROM users WHERE email = ?1 LIMIT 1")
      .bind(email)
      .first();
    if (existed) {
      return json({ ok: false, error: "Email đã tồn tại." }, 409);
    }

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, password_salt, display_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
      )
      .bind(id, email, hash, salt, displayName, now)
      .run();

    const token = await signToken({ uid: id, email }, env.AUTH_SECRET);
    return json({
      ok: true,
      token,
      user: { id, email, display_name: displayName }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: String(error && error.message ? error.message : error)
      },
      500
    );
  }
}

function clean(v) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}
