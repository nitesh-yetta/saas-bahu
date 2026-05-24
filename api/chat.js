import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function buildSystemPrompt(lang, userProfile) {
  const baseEN = `You are the Harmony Guide in the Saas-Bahu Harmony app — a wise, warm, culturally sensitive AI counselor for Indian mother-in-law and daughter-in-law relationships.

Rules:
- Always respond in English
- Honest, balanced, non-judgmental guidance
- Deeply understand Indian joint family dynamics
- Respect BOTH parties — no villains, only people doing their best
- When someone is clearly wrong, say so with compassion but clearly
- Keep responses under 150 words unless detailed advice is needed
- End with one concrete actionable step the user can take today`;

  const baseHI = `आप 'सास-बहू सामंजस्य' ऐप में हार्मनी गाइड हैं — एक बुद्धिमान, गर्मजोशी से भरे और सांस्कृतिक रूप से जागरूक AI परामर्शदाता।

नियम:
- हमेशा हिंदी में जवाब दें
- ईमानदार, संतुलित और बिना निर्णय के मार्गदर्शन दें
- भारतीय संयुक्त परिवार की गतिशीलता को गहराई से समझें
- दोनों पक्षों का सम्मान करें
- जब कोई गलत हो, करुणा के साथ स्पष्ट रूप से कहें
- 150 शब्दों से कम में उत्तर दें
- अंत में एक ठोस कदम बताएं`;

  const base = lang === 'hi' ? baseHI : baseEN;
  if (!userProfile) return base;

  const ctx = `

── USER MEMORY (personalise every response using this) ──
Role in family : ${userProfile.persona || 'not set yet'}
Name           : ${userProfile.name || 'not shared yet'}
Family context : ${userProfile.family_context || 'not described yet'}
Main tensions  : ${userProfile.tension_points || 'not identified yet'}
What helped    : ${userProfile.what_helped || 'not recorded yet'}
What failed    : ${userProfile.what_not_helped || 'not recorded yet'}
Past sessions  : ${userProfile.session_count || 1}
Summary so far : ${userProfile.conversation_summary || 'first session'}
─────────────────────────────────────────────────────────
Use this memory to:
- Address them by name if known
- Reference their specific situation, not generic advice
- Build on what has already been discussed
- Track progress and celebrate improvements`;

  return base + ctx;
}

async function summariseAndSave(userId, messages, existingProfile) {
  const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const prompt = `Extract a short profile update from this conversation as JSON only.
No explanation, no markdown, just raw JSON.

Existing profile: ${JSON.stringify(existingProfile || {})}

Conversation:
${text}

Return JSON with only fields that have new or updated info:
{
  "persona": "saas or bahu",
  "name": "first name if mentioned",
  "family_context": "brief family situation",
  "tension_points": "main relationship issues",
  "what_helped": "advice or actions that worked",
  "what_not_helped": "things that did not work",
  "conversation_summary": "2-3 sentence summary of this conversation"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const updated = {
      user_id: userId,
      ...existingProfile,
      ...parsed,
      session_count: (existingProfile?.session_count || 0) + 1,
      last_seen: new Date().toISOString(),
    };

    await supabase
      .from('user_profiles')
      .upsert(updated, { onConflict: 'user_id' });

  } catch (err) {
    console.error('Summarise error:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, lang = 'en', userId, saveContext = false } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (messages.length > 50) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error' });

  try {
    // Load user profile from Supabase
    let userProfile = null;
    if (userId && process.env.SUPABASE_URL) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      userProfile = data;
    }

    // Build personalised prompt
    const finalSystem = system || buildSystemPrompt(lang, userProfile);

    // Call Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: finalSystem,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'AI error' });
    }

    // Save context every 3 messages
    if (userId && saveContext && messages.length % 3 === 0 && process.env.SUPABASE_URL) {
      summariseAndSave(userId, messages, userProfile);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Server error — please try again' });
  }
}
