/**
 * Cloudflare Worker — Anthropic API proxy for resume chatbot
 *
 * SETUP INSTRUCTIONS:
 * ─────────────────────────────────────────────────────────────
 * 1. Go to https://dash.cloudflare.com and sign in (free account)
 * 2. Click "Workers & Pages" in the left sidebar
 * 3. Click "Create" → "Create Worker"
 * 4. Name it something like "resume-chat" and click "Deploy"
 * 5. Click "Edit code" and paste the entire contents of this file
 * 6. Click "Save and deploy"
 * 7. Go to the worker's Settings → Variables → Add variable:
 *      Name:  ANTHROPIC_API_KEY
 *      Value: your API key from console.anthropic.com
 *    Check "Encrypt" to keep it secret, then Save.
 * 8. Copy your worker URL (e.g. https://resume-chat.yourname.workers.dev)
 * 9. Open resume.html and set the WORKER_URL constant to that URL:
 *      const WORKER_URL = 'https://resume-chat.yourname.workers.dev';
 * ─────────────────────────────────────────────────────────────
 *
 * OPTIONAL — Restrict to your domain only (recommended):
 * In the worker, set ALLOWED_ORIGIN below to your GitHub Pages URL,
 * e.g. 'https://seansnodgrass.com' or 'https://yourusername.github.io'
 */

const ALLOWED_ORIGIN = '*'; // Change to your domain for production, e.g. 'https://seansnodgrass.com'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'; // Fast + cheap — ideal for a chatbot
const MAX_TOKENS = 512;

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders(ALLOWED_ORIGIN),
            });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // Parse incoming request from resume.html
        let body;
        try {
            body = await request.json();
        } catch {
            return errorResponse('Invalid JSON', 400);
        }

        const { system, messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return errorResponse('messages array is required', 400);
        }

        if (!env.ANTHROPIC_API_KEY) {
            return errorResponse('ANTHROPIC_API_KEY not configured in Worker environment', 500);
        }

        // Forward to Anthropic Messages API
        let anthropicResponse;
        try {
            anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: ANTHROPIC_MODEL,
                    max_tokens: MAX_TOKENS,
                    system: system || '',
                    messages: messages,
                }),
            });
        } catch (err) {
            return errorResponse('Failed to reach Anthropic API: ' + err.message, 502);
        }

        if (!anthropicResponse.ok) {
            const errorText = await anthropicResponse.text();
            return errorResponse('Anthropic API error: ' + errorText, anthropicResponse.status);
        }

        const data = await anthropicResponse.json();

        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(ALLOWED_ORIGIN),
            },
        });
    },
};

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function errorResponse(message, status) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(ALLOWED_ORIGIN),
        },
    });
}
