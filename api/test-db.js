/**
 * api/test-db.js
 * ─────────────────────────────────────────────────────
 * Temporary diagnostic endpoint.
 * Visit: https://saasbahu-harmony.com/api/test-db
 * DELETE this file after confirming connection works.
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const results = {
    timestamp: new Date().toISOString(),
    env_checks: {},
    supabase: {},
    anthropic: {},
  };

  // ── 1. Check environment variables exist ─────────────────────────────────
  results.env_checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    ? `✅ Set (starts with: ${process.env.ANTHROPIC_API_KEY.slice(0,12)}...)`
    : '❌ MISSING';

  results.env_checks.SUPABASE_URL = process.env.SUPABASE_URL
    ? `✅ Set (${process.env.SUPABASE_URL})`
    : '❌ MISSING';

  results.env_checks.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY
    ? `✅ Set (starts with: ${process.env.SUPABASE_SECRET_KEY.slice(0,12)}...)`
    : '❌ MISSING';

  // ── 2. Test Supabase connection ───────────────────────────────────────────
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      );

      // Try to count rows in user_profiles
      const { count, error } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.supabase.status = '❌ Connected but query failed';
        results.supabase.error = error.message;
        results.supabase.hint = error.message.includes('does not exist')
          ? 'Table missing — run supabase-setup.sql in Supabase SQL Editor'
          : 'Check your service_role key is correct';
      } else {
        results.supabase.status = '✅ Connected successfully';
        results.supabase.user_profiles_count = count;
        results.supabase.hint = 'Supabase is working correctly';
      }

      // Try to insert a test row then delete it
      const testId = 'test_' + Date.now();
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({ user_id: testId, persona: 'test', session_count: 0 });

      if (insertError) {
        results.supabase.write_test = '❌ Cannot write to database: ' + insertError.message;
      } else {
        // Clean up test row
        await supabase.from('user_profiles').delete().eq('user_id', testId);
        results.supabase.write_test = '✅ Read and write both working';
      }

    } catch (err) {
      results.supabase.status = '❌ Connection failed';
      results.supabase.error = err.message;
    }
  } else {
    results.supabase.status = '⏭️ Skipped — env vars missing';
  }

  // ── 3. Test Anthropic connection ──────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      });
      const d = await r.json();
      results.anthropic.status = d.content?.[0]?.text
        ? '✅ Connected — API key works'
        : '❌ Error: ' + JSON.stringify(d.error);
    } catch (err) {
      results.anthropic.status = '❌ Failed: ' + err.message;
    }
  } else {
    results.anthropic.status = '⏭️ Skipped — env var missing';
  }

  // ── Return results as clean HTML page ─────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Saas-Bahu — Connection Test</title>
  <style>
    body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#fffdf9;color:#2c1a0e}
    h1{color:#c0385a;margin-bottom:4px}
    h2{color:#8b7355;font-size:14px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em}
    .row{padding:10px 14px;border-radius:8px;margin-bottom:6px;font-size:14px;background:#f9f5ef;border:1px solid #eae0d0}
    .ok{background:#ebf5ef;border-color:#b8dcca}
    .err{background:#fef0f0;border-color:#f5c4c4}
    .label{font-weight:600;margin-bottom:3px}
    .note{font-size:12px;color:#8b7355;margin-top:16px;padding:12px;background:#fdf6e3;border-radius:8px;border:1px solid #f0d9a0}
  </style>
</head>
<body>
  <h1>🪷 Connection Diagnostic</h1>
  <p style="font-size:13px;color:#8b7355">${results.timestamp}</p>

  <h2>Environment Variables</h2>
  ${Object.entries(results.env_checks).map(([k,v]) => `
    <div class="row ${v.startsWith('✅')?'ok':'err'}">
      <div class="label">${k}</div>
      <div>${v}</div>
    </div>`).join('')}

  <h2>Supabase Database</h2>
  ${Object.entries(results.supabase).map(([k,v]) => `
    <div class="row ${String(v).includes('✅')?'ok':String(v).includes('❌')?'err':''}">
      <div class="label">${k}</div>
      <div>${v}</div>
    </div>`).join('')}

  <h2>Anthropic AI</h2>
  <div class="row ${results.anthropic.status?.includes('✅')?'ok':'err'}">
    <div>${results.anthropic.status}</div>
  </div>

  <div class="note">
    ⚠️ Delete <strong>api/test-db.js</strong> from your GitHub repo after fixing the issue.
    This page exposes internal status and should not stay live.
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
