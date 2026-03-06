export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "bat-tu-tu-vi-ai-workspace-v2",
      now: new Date().toISOString()
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}
