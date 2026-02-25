<?php
/**
 * Simple URL Shortener Application
 * Standalone PHP implementation (no Laravel dependencies needed)
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// ============================================
// KONFIGURASI - GANTI DOMAIN DISINI
// ============================================
$customDomain = ''; // Diisi otomatis oleh Cloudflare Pages (CF_PAGES_URL)
// Atau isi manual: $customDomain = 'your-domain.com';
// Jika ingin menggunakan localhost saat development, kosongkan: $customDomain = '';
// ============================================

// Detect Cloudflare Pages environment
if (isset($_SERVER['CF_PAGES_URL'])) {
    $customDomain = $_SERVER['CF_PAGES_URL'];
    $customDomain = preg_replace('#^https?://#', '', $customDomain);
}

// Database configuration
$dbFile = __DIR__ . '/../database/urls.json';

// Initialize database file if not exists
if (!file_exists(dirname($dbFile))) {
    mkdir(dirname($dbFile), 0777, true);
}
if (!file_exists($dbFile)) {
    file_put_contents($dbFile, json_encode([]));
}

// Get the request URI
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Remove query string
$requestUri = strtok($requestUri, '?');

// Route handling
$baseUrl = '/';

// Home page - show form
if ($requestUri === $baseUrl || $requestUri === '/') {
    if ($requestMethod === 'GET') {
        header('Content-Type: text/html; charset=UTF-8');
        ?>
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
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        p {
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        input[type="url"] {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="url"]:focus {
            outline: none;
            border-color: #667eea;
        }
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
        .result.show {
            display: block;
        }
        .result a {
            color: #667eea;
            font-weight: 600;
            word-break: break-all;
        }
        .error {
            background: #fee;
            color: #c00;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        .error.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 URL Shortener</h1>
        <p>Shorten your long URLs instantly!</p>
        
        <form method="POST" action="/shorten">
            <div class="form-group">
                <input type="url" name="url" placeholder="Enter your long URL here..." required>
            </div>
            <button type="submit">Shorten URL</button>
        </form>
        
        <div class="error" id="error"></div>
        <div class="result" id="result"></div>
    </div>

    <script>
        // Handle form submission
        document.querySelector('form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const errorEl = document.getElementById('error');
            const resultEl = document.getElementById('result');
            
            errorEl.classList.remove('show');
            resultEl.classList.remove('show');
            
            try {
                const response = await fetch('/shorten', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.error) {
                    errorEl.textContent = data.error;
                    errorEl.classList.add('show');
                } else {
                    resultEl.innerHTML = 'Your shortened URL:<br><a href="' + data.short_url + '" target="_blank">' + data.short_url + '</a>';
                    resultEl.classList.add('show');
                }
            } catch (err) {
                errorEl.textContent = 'An error occurred. Please try again.';
                errorEl.classList.add('show');
            }
        });
    </script>
</body>
</html>
        <?php
        exit;
    }
}

// Handle URL shortening
if ($requestUri === '/shorten' && $requestMethod === 'POST') {
    header('Content-Type: application/json');
    
    $url = $_POST['url'] ?? '';
    
    if (empty($url)) {
        echo json_encode(['error' => 'URL is required']);
        exit;
    }
    
    // Validate URL
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        echo json_encode(['error' => 'Invalid URL format']);
        exit;
    }
    
    // Read existing URLs
    $urls = json_decode(file_get_contents($dbFile), true);
    
    // Generate short code
    $code = generateShortCode();
    
    // Save URL
    $urls[$code] = [
        'original_url' => $url,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    file_put_contents($dbFile, json_encode($urls));
    
    // Use custom domain or default to current host
    if (!empty($customDomain)) {
        $shortUrl = 'http://' . $customDomain . '/' . $code;
    } else {
        $shortUrl = 'http://' . $_SERVER['HTTP_HOST'] . '/' . $code;
    }
    
    echo json_encode([
        'success' => true,
        'short_url' => $shortUrl,
        'code' => $code
    ]);
    exit;
}

// Handle redirect from short URL
$code = ltrim($requestUri, '/');
if (!empty($code) && $requestMethod === 'GET') {
    $urls = json_decode(file_get_contents($dbFile), true);
    
    if (isset($urls[$code])) {
        header('Location: ' . $urls[$code]['original_url']);
        exit;
    } else {
        http_response_code(404);
        echo 'URL not found';
        exit;
    }
}

// 404 for unknown routes
http_response_code(404);
echo 'Page not found';

/**
 * Generate a short code for the URL
 */
function generateShortCode($length = 6) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= $chars[rand(0, strlen($chars) - 1)];
    }
    return $code;
}
