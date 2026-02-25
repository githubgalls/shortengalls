/**
 * URL Shortener - Cloudflare Workers Version
 * Uses Workers KV for data storage (free tier)
 * SECURE VERSION - XSS Protection, Open Redirect Prevention, Rate Limiting
 */

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 500px;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        p { color: #666; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        input[type="url"] {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="url"]:focus { outline: none; border-color: #667eea; }
        button {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 10px;
            display: none;
        }
        .result.show { display: block; }
        .result a { color: #667eea; font-weight: 600; word-break: break-all; }
        .error {
            background: #fee;
            color: #c00;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        .error.show { display: block; }
        .urls-list {
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
        .urls-list h3 { color: #333; margin-bottom: 15px; }
        .url-item {
            background: #f9f9f9;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .url-item a { color: #667eea; text-decoration: none; }
        .url-item .original { color: #666; font-size: 12px; word-break: break-all; }
        .url-item .clicks { color: #999; font-size: 11px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 URL Shortener</h1>
        <p>Shorten your long URLs instantly!</p>
        
        <form id="shortenForm">
            <div class="form-group">
                <input type="url" name="url" placeholder="Enter your long URL here..." autocomplete="off" required>
            </div>
            <button type="submit">Shorten URL</button>
        </form>
        
        <div class="error" id="error"></div>
        <div class="result" id="result"></div>
        
        <div class="urls-list" id="urlsList"></div>
    </div>

    <script>
        // XSS Protection - Escape HTML special characters
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        const form = document.getElementById('shortenForm');
        const errorEl = document.getElementById('error');
        const resultEl = document.getElementById('result');
        const urlsListEl = document.getElementById('urlsList');
        
        // Load existing URLs - XSS Protected
        async function loadUrls() {
            try {
                const response = await fetch('/api/urls');
                const urls = await response.json();
                
                if (urls.length > 0) {
                    let html = '<h3>Your Shortened URLs</h3>';
                    urls.forEach(function(u) {
                        html += '<div class="url-item">';
                        html += '<a href="' + escapeHtml(u.short_url) + '" target="_blank">' + escapeHtml(u.short_url) + '</a><br>';
                        html += '<span class="original">' + escapeHtml(u.original_url) + '</span><br>';
                        html += '<span class="clicks">' + u.clicks + ' clicks</span>';
                        html += '</div>';
                    });
                    urlsListEl.innerHTML = html;
                }
            } catch (e) {
                console.log('No URLs yet');
            }
        }
        
        loadUrls();
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const url = formData.get('url');
            
            errorEl.classList.remove('show');
            resultEl.classList.remove('show');
            
            try {
                const response = await fetch('/api/shorten', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    errorEl.textContent = data.error;
                    errorEl.classList.add('show');
                } else {
                    // XSS Protected
                    resultEl.innerHTML = 'Your shortened URL:<br><a href="' + escapeHtml(data.short_url) + '" target="_blank">' + escapeHtml(data.short_url) + '</a>';
                    resultEl.classList.add('show');
                    loadUrls();
                }
            } catch (err) {
                errorEl.textContent = 'An error occurred. Please try again.';
                errorEl.classList.add('show');
            }
        });
    </script>
</body>
</html>
`;

// Rate limiting cache
const rateLimitCache = new Map();

// Security: Allowed URL schemes
const ALLOWED_SCHEMES = ["http:", "https:"];

// Security: Blocked patterns
const BLOCKED_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /about:/i,
  /chrome:/i,
];

// Rate limiting config
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function generateShortCode(length = 6) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return ALLOWED_SCHEMES.includes(url.protocol);
  } catch (_) {
    return false;
  }
}

function isMaliciousUrl(string) {
  try {
    const url = new URL(string);
    if (!ALLOWED_SCHEMES.includes(url.protocol)) {
      return true;
    }
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(string)) {
        return true;
      }
    }
    return false;
  } catch (_) {
    return true;
  }
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  for (const [key, timestamp] of rateLimitCache.entries()) {
    if (timestamp < windowStart) {
      rateLimitCache.delete(key);
    }
  }

  const requestCount = (rateLimitCache.get(ip) || []).filter(
    (t) => t > windowStart,
  ).length;

  if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  const timestamps = rateLimitCache.get(ip) || [];
  timestamps.push(now);
  rateLimitCache.set(ip, timestamps);

  return false;
}

function getClientIP(request) {
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP) return cfIP;
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0];
  return "unknown";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const clientIP = getClientIP(request);

    // Rate limiting
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Dynamic CORS instead of wildcard
    const corsHeaders = {
      "Access-Control-Allow-Origin": url.origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/" || path === "") {
      if (method === "GET") {
        return new Response(HTML_PAGE, {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            ...corsHeaders,
          },
        });
      }
    }

    if (path === "/api/shorten" && method === "POST") {
      try {
        const body = await request.json();
        const originalUrl = body.url;

        if (!originalUrl) {
          return new Response(JSON.stringify({ error: "URL is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // URL length validation
        if (originalUrl.length > 2048) {
          return new Response(
            JSON.stringify({ error: "URL too long (max 2048 characters)" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        if (!isValidUrl(originalUrl)) {
          return new Response(
            JSON.stringify({
              error: "Invalid URL format. Only HTTP and HTTPS are allowed.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        if (isMaliciousUrl(originalUrl)) {
          return new Response(
            JSON.stringify({ error: "This URL scheme is not allowed" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        let code;
        let existing;
        let attempts = 0;
        const maxAttempts = 10;

        do {
          code = generateShortCode();
          existing = await env.URLS.get(code);
          attempts++;
          if (attempts >= maxAttempts) {
            code = generateShortCode(8);
            break;
          }
        } while (existing);

        const urlData = {
          original_url: originalUrl,
          created_at: new Date().toISOString(),
          clicks: 0,
        };

        await env.URLS.put(code, JSON.stringify(urlData));
        const shortUrl = url.origin + "/" + code;

        return new Response(
          JSON.stringify({ success: true, short_url: shortUrl, code: code }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // API: Get all URLs - XSS Protected on client side
    if (path === "/api/urls" && method === "GET") {
      try {
        const list = await env.URLS.list();
        const urls = [];

        for (const key of list.keys) {
          const data = JSON.parse(await env.URLS.get(key.name));
          urls.push({
            code: key.name,
            short_url: url.origin + "/" + key.name,
            original_url: data.original_url,
            clicks: data.clicks || 0,
            created_at: data.created_at,
          });
        }

        urls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return new Response(JSON.stringify(urls), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Redirect with open redirect protection
    if (path.startsWith("/") && path.length > 1 && !path.startsWith("/api")) {
      const code = path.slice(1);

      // Validate code format
      if (!/^[a-zA-Z0-9]+$/.test(code)) {
        return new Response("Page not found", { status: 404 });
      }

      const data = await env.URLS.get(code);

      if (data) {
        const urlData = JSON.parse(data);
        urlData.clicks = (urlData.clicks || 0) + 1;
        await env.URLS.put(code, JSON.stringify(urlData));

        if (
          isValidUrl(urlData.original_url) &&
          !isMaliciousUrl(urlData.original_url)
        ) {
          return Response.redirect(urlData.original_url, 302);
        }
        return Response.redirect(url.origin, 302);
      }
    }

    return new Response("Page not found", { status: 404 });
  },
};
