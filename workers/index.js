/**
 * URL Shortener - Cloudflare Workers Version
 * SECURE VERSION with Google Safe Browsing API + Full Security
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
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
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
        .warning {
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            font-size: 13px;
        }
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
            <button type="submit" id="submitBtn">Shorten URL</button>
        </form>
        
        <div class="error" id="error"></div>
        <div class="result" id="result"></div>
        <div class="warning">
            ⚠️ This service is for legitimate URLs only. Abuse will be reported.
        </div>
        
        <div class="footer">
            &copy; 2026 | <a href="#">GALLS</a>
        </div>
    </div>

    <script>
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        const form = document.getElementById('shortenForm');
        const errorEl = document.getElementById('error');
        const resultEl = document.getElementById('result');
        const submitBtn = document.getElementById('submitBtn');
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const url = formData.get('url');
            
            errorEl.classList.remove('show');
            resultEl.classList.remove('show');
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Checking URL...';
            
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
                    resultEl.innerHTML = 'Your shortened URL:<br><a href="' + escapeHtml(data.short_url) + '" target="_blank">' + escapeHtml(data.short_url) + '</a>';
                    resultEl.classList.add('show');
                }
            } catch (err) {
                errorEl.textContent = 'An error occurred. Please try again.';
                errorEl.classList.add('show');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Shorten URL';
            }
        });
    </script>
</body>
</html>
`;

// ============ SECURITY CONFIG ============
const rateLimitCache = new Map();
const ALLOWED_SCHEMES = ["http:", "https:"];
const BLOCKED_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /about:/i,
  /chrome:/i,
];
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Google Safe Browsing API config
const SAFE_BROWSING_API_KEY = "YOUR_SAFE_BROWSING_API_KEY"; // Replace with your API key
const SAFE_BROWSING_URL =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const PHISHING_KEYWORDS = [
  "login",
  "signin",
  "verify",
  "secure",
  "account",
  "update",
  "confirm",
  "banking",
  "password",
  "credential",
  "auth",
  "paypal",
  "apple",
  "microsoft",
  "google",
  "amazon",
  "facebook",
  "instagram",
  "twitter",
  "netflix",
  "spotify",
  "coinbase",
  "binance",
  "metamask",
  "wallet",
  "crypto",
];

const BLOCKED_TLDS = [
  ".tk",
  ".ml",
  ".ga",
  ".cf",
  ".gq",
  ".xyz",
  ".top",
  ".work",
  ".click",
  ".link",
];

// ============ HELPER FUNCTIONS ============
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

function isSuspiciousUrl(string) {
  try {
    const url = new URL(string);
    const hostname = url.hostname.toLowerCase();

    for (const tld of BLOCKED_TLDS) {
      if (hostname.endsWith(tld)) {
        return true;
      }
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      return true;
    }

    const parts = hostname.split(".");
    if (parts.length > 4) {
      return true;
    }

    const hasPhishingKeyword = PHISHING_KEYWORDS.some((kw) =>
      hostname.includes(kw),
    );

    if (hasPhishingKeyword) {
      const freeTLDs = [
        ".tk",
        ".ml",
        ".ga",
        ".cf",
        ".gq",
        ".xyz",
        ".top",
        ".work",
        ".click",
        ".link",
        ".pw",
        ".cc",
        ".ws",
      ];
      for (const tld of freeTLDs) {
        if (hostname.endsWith(tld)) {
          return true;
        }
      }
    }

    return false;
  } catch (_) {
    return true;
  }
}

// ============ GOOGLE SAFE BROWSING CHECK ============
async function checkSafeBrowsing(url, apiKey) {
  if (!apiKey || apiKey === "YOUR_SAFE_BROWSING_API_KEY") {
    console.log("Safe Browsing API key not configured, skipping...");
    return { safe: true };
  }

  try {
    const requestBody = {
      client: {
        clientId: "url-shortener-galls",
        clientVersion: "1.0.0",
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: url }],
      },
    };

    const response = await fetch(SAFE_BROWSING_URL + "?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error("Safe Browsing API error:", response.status);
      return { safe: true };
    }

    const data = await response.json();

    if (data.matches && data.matches.length > 0) {
      return {
        safe: false,
        threatType: data.matches[0].threatType,
        platformType: data.matches[0].platformType,
      };
    }

    return { safe: true };
  } catch (e) {
    console.error("Safe Browsing check failed:", e);
    return { safe: true };
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

// ============ MAIN HANDLER ============
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const clientIP = getClientIP(request);

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

        if (isSuspiciousUrl(originalUrl)) {
          console.log(
            "Suspicious URL detected by local heuristics:",
            originalUrl,
          );
        }

        // Google Safe Browsing API check
        const safeBrowsingResult = await checkSafeBrowsing(
          originalUrl,
          env.SAFE_BROWSING_API_KEY || SAFE_BROWSING_API_KEY,
        );

        if (!safeBrowsingResult.safe) {
          console.log(
            "URL blocked by Safe Browsing:",
            originalUrl,
            safeBrowsingResult,
          );
          return new Response(
            JSON.stringify({
              error:
                "This URL has been flagged as potentially harmful by Google's Safe Browsing service.",
              threatType: safeBrowsingResult.threatType,
            }),
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
          ip: clientIP,
          user_agent: request.headers.get("User-Agent") || "unknown",
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

    if (path.startsWith("/") && path.length > 1 && !path.startsWith("/api")) {
      const code = path.slice(1);

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
