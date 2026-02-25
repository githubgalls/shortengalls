/**
 * URL Shortener - Cloudflare Workers Version
 * For Cloudflare Pages
 * SECURE VERSION - XSS Protection, Open Redirect Prevention, Rate Limiting
 */

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener Galls</title>
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
        .result-container { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .result-container input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; min-width: 200px; }
        .action-btn { padding: 10px 15px; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; white-space: nowrap; }
        .copy-btn { background: #667eea; }
        .copy-btn:hover { background: #5568d3; }
        .copy-btn.copied { background: #28a745; }
        .refresh-btn { background: #9e9e9e; }
        .refresh-btn:hover { background: #757575; }
        .error {
            background: #fee;
            color: #c00;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        .error.show { display: block; }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #999;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 URL Shorten</h1>
        <p>Memperpendek URL secara instant</p>
        <form id="shortenForm">
            <div class="form-group">
                <input type="url" name="url" placeholder="Enter your long URL here..." autocomplete="off" required>
            </div>
            <button type="submit">Shorten URL</button>
        </form>
        <div class="error" id="error"></div>
        <div class="result" id="result"></div>
        <div class="footer">
            © <a href="#">2026 | GALLS</a>
        </div>
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
                    // Use textContent instead of innerHTML to prevent XSS
                    errorEl.textContent = data.error;
                    errorEl.classList.add('show');
                } else {
                    // XSS Protected - escape the short_url before displaying
                    const safeUrl = escapeHtml(data.short_url);
                    resultEl.innerHTML = '<div class="result-container"><input type="text" value="' + safeUrl + '" readonly id="shortUrlInput"><button class="action-btn copy-btn" onclick="copyUrl()">Copy</button><button class="action-btn refresh-btn" onclick="resetForm()">Refresh</button></div>';
                    resultEl.classList.add('show');
                }
            } catch (err) {
                errorEl.textContent = 'An error occurred. Please try again.';
                errorEl.classList.add('show');
            }
        });
        
        function copyUrl() {
            const input = document.getElementById('shortUrlInput');
            const btn = document.querySelector('.copy-btn');
            input.select();
            input.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(input.value).then(function() {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(function() {
                    btn.textContent = 'Copy';
                    btn.classList.remove('copied');
                }, 2000);
            });
        }
        
        function resetForm() {
            form.reset();
            errorEl.classList.remove('show');
            resultEl.classList.remove('show');
        }
    </script>
</body>
</html>
`;

// Rate limiting cache (in-memory for demo, use KV in production)
const rateLimitCache = new Map();

// Security: Allowed URL schemes
const ALLOWED_SCHEMES = ["http:", "https:"];

// Security: Blocked domains/patterns
const BLOCKED_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /about:/i,
  /chrome:/i,
];

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

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

// Check for malicious URL patterns
function isMaliciousUrl(string) {
  try {
    const url = new URL(string);
    // Check for dangerous protocols
    if (!ALLOWED_SCHEMES.includes(url.protocol)) {
      return true;
    }
    // Check for blocked patterns in the full URL
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

// Rate limiting function
function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Clean old entries
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

  // Add current request
  const timestamps = rateLimitCache.get(ip) || [];
  timestamps.push(now);
  rateLimitCache.set(ip, timestamps);

  return false;
}

// Get client IP from request
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

    const corsHeaders = {
      "Access-Control-Allow-Origin": url.origin, // Dynamic origin instead of wildcard
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

        // URL length validation (max 2048 characters)
        if (originalUrl.length > 2048) {
          return new Response(
            JSON.stringify({ error: "URL too long (max 2048 characters)" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        // Validate URL format and scheme
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

        // Check for malicious URLs
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
            // Regenerate with different length if collision happens too many times
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

    // Redirect with open redirect protection
    if (path.startsWith("/") && path.length > 1 && !path.startsWith("/api")) {
      const code = path.slice(1);

      // Validate code format (alphanumeric only)
      if (!/^[a-zA-Z0-9]+$/.test(code)) {
        return new Response("Page not found", { status: 404 });
      }

      const data = await env.URLS.get(code);

      if (data) {
        const urlData = JSON.parse(data);
        urlData.clicks = (urlData.clicks || 0) + 1;
        await env.URLS.put(code, JSON.stringify(urlData));

        // Validate redirect URL to prevent open redirect
        if (
          isValidUrl(urlData.original_url) &&
          !isMaliciousUrl(urlData.original_url)
        ) {
          return Response.redirect(urlData.original_url, 302);
        }
        // If invalid, redirect to home page instead
        return Response.redirect(url.origin, 302);
      }
    }

    return new Response("Page not found", { status: 404 });
  },
};
