/**
 * URL Shortener - Cloudflare Workers Version
 * For Cloudflare Pages
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
                    errorEl.textContent = data.error;
                    errorEl.classList.add('show');
                } else {
                    resultEl.innerHTML = '<div class="result-container"><input type="text" value="' + data.short_url + '" readonly id="shortUrlInput"><button class="action-btn copy-btn" onclick="copyUrl()">Copy</button><button class="action-btn refresh-btn" onclick="resetForm()">Refresh</button></div>';
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
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
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

        if (!isValidUrl(originalUrl)) {
          return new Response(JSON.stringify({ error: "Invalid URL format" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        let code;
        let existing;
        do {
          code = generateShortCode();
          existing = await env.URLS.get(code);
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

    if (path.startsWith("/") && path.length > 1 && !path.startsWith("/api")) {
      const code = path.slice(1);
      const data = await env.URLS.get(code);

      if (data) {
        const urlData = JSON.parse(data);
        urlData.clicks = (urlData.clicks || 0) + 1;
        await env.URLS.put(code, JSON.stringify(urlData));
        return Response.redirect(urlData.original_url, 302);
      }
    }

    return new Response("Page not found", { status: 404 });
  },
};
