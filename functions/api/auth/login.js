import { hashPassword, initSchema, json, requireDb, signToken, verifyPassword } from "../_db.js";

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env);
    await initSchema(db);

    const body = await request.json().catch(() => ({}));
    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json({ ok: false, error: "Thiếu email hoặc mật khẩu." }, 400);
    }

    const user = await db
      .prepare(
        "SELECT id, email, password_hash, password_salt, display_name FROM users WHERE email = ?1 LIMIT 1"
      )
      .bind(email)
      .first();
    if (!user) {
      return json({ ok: false, error: "Sai email hoặc mật khẩu." }, 401);
    }

    const matched = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!matched) {
      return json({ ok: false, error: "Sai email hoặc mật khẩu." }, 401);
    }

    const token = await signToken({ uid: user.id, email: user.email }, env.AUTH_SECRET);
    return json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      }
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
