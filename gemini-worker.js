const ALLOWED_ORIGINS = [
  'https://mca.glacierclient.xyz',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const MODEL = 'gemini-2.5-flash';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    if (!env.GEMINI_API_KEY) return json({ error: 'Server is missing GEMINI_API_KEY secret' }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, cors); }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const contents = messages
      .filter((m) => m && typeof m.text === 'string' && m.text.trim())
      .map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text) }],
      }));

    if (contents.length === 0) return json({ error: 'No messages provided' }, 400, cors);

    const payload = {
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };
    if (body.system) payload.systemInstruction = { parts: [{ text: String(body.system) }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: 'Upstream request failed: ' + (e && e.message) }, 502, cors);
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: `Gemini ${upstream.status}: ${detail.slice(0, 300)}` }, 502, cors);
    }

    return new Response(upstream.body, {
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
