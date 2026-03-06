import { bearerToken, initSchema, json, requireDb, verifyToken } from "./_db.js";

export async function onRequestGet(ctx) {
  return withAuth(ctx, async (db, user) => {
    const rows = await db
      .prepare("SELECT id, name, data_json, updated_at FROM profiles WHERE user_id = ?1 ORDER BY updated_at DESC")
      .bind(user.id)
      .all();
    const results = Array.isArray(rows?.results) ? rows.results : [];
    return json({
      ok: true,
      profiles: results.map((r) => ({
        id: r.id,
        name: r.name,
        updated_at: r.updated_at,
        data: safeParse(r.data_json)
      }))
    });
  });
}

export async function onRequestPost(ctx) {
  return withAuth(ctx, async (db, user, request) => {
    const body = await request.json().catch(() => ({}));
    const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
    if (!profile) return json({ ok: false, error: "Thiếu profile." }, 400);

    const id = clean(profile.id) || crypto.randomUUID();
    const name = clean(profile.name || "Hồ sơ");
    const now = new Date().toISOString();
    const payload = JSON.stringify(profile);

    await db
      .prepare(
        "INSERT INTO profiles (id, user_id, name, data_json, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json, updated_at = excluded.updated_at"
      )
      .bind(id, user.id, name, payload, now)
      .run();

    return json({ ok: true, id, updated_at: now });
  });
}

export async function onRequestDelete(ctx) {
  return withAuth(ctx, async (db, user, request) => {
    const url = new URL(request.url);
    const id = clean(url.searchParams.get("id"));
    if (!id) return json({ ok: false, error: "Thiếu id." }, 400);

    await db
      .prepare("DELETE FROM profiles WHERE id = ?1 AND user_id = ?2")
      .bind(id, user.id)
      .run();
    return json({ ok: true });
  });
}

async function withAuth({ request, env }, fn) {
  try {
    const db = requireDb(env);
    await initSchema(db);

    const token = bearerToken(request);
    const payload = await verifyToken(token, env.AUTH_SECRET);
    if (!payload || !payload.uid) return json({ ok: false, error: "Chưa đăng nhập." }, 401);

    const user = await db
      .prepare("SELECT id, email, display_name FROM users WHERE id = ?1 LIMIT 1")
      .bind(payload.uid)
      .first();
    if (!user) return json({ ok: false, error: "Phiên đăng nhập không hợp lệ." }, 401);

    return await fn(db, user, request);
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

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
