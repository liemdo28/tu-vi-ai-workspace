import { bearerToken, initSchema, json, requireDb, verifyToken } from "../_db.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = requireDb(env);
    await initSchema(db);

    const token = bearerToken(request);
    const payload = await verifyToken(token, env.AUTH_SECRET);
    if (!payload || !payload.uid) {
      return json({ ok: false, error: "Chưa đăng nhập." }, 401);
    }

    const user = await db
      .prepare("SELECT id, email, display_name FROM users WHERE id = ?1 LIMIT 1")
      .bind(payload.uid)
      .first();
    if (!user) return json({ ok: false, error: "Tài khoản không tồn tại." }, 401);

    return json({ ok: true, user });
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
