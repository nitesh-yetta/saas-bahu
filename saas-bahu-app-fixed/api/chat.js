/**
 * Saas-Bahu Harmony — Secure API Proxy
 * ─────────────────────────────────────
 * This file runs on Vercel's servers only.
 * Your ANTHROPIC_API_KEY is NEVER sent to the browser.
 * The frontend calls /api/chat → this file → Anthropic → back to user.
 */

export default async function handler(req, res) {

  // ── 1. Only allow POST requests ──────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 2. Basic origin check (add your domain here after deploying) ─────────
  const allowedOrigins = [
    'http://localhost:3000',
    'https://your-app-name.vercel.app', // ← replace with your Vercel URL
    // 'https://yourdomain.com',         // ← add your custom domain here
  ];
  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
    // In production, uncomment the block below to enforce origin restriction
    // return res.status(403).json({ error: 'Forbidden' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ── 3. Handle browser preflight OPTIONS request ──────────────────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── 4. Validate the request body ─────────────────────────────────────────
  const { messages, system } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  // Safety cap — never let a single request send more than 40 messages
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Too many messages in request' });
  }

  // ── 5. Check API key exists ───────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── 6. Forward the request to Anthropic ──────────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,                        // ← key injected here, server-side only
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: system || '',
        messages: messages,
      }),
    });

    const data = await response.json();

    // If Anthropic returned an error, pass it through safely
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({
        error: 'AI service error',
        detail: data?.error?.message || 'Unknown error',
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy fetch error:', err);
    return res.status(500).json({ error: 'Failed to reach AI service' });
  }
}
