<!DOCTYPE html>
<html>
<head>
    <title>Laravel URL Shortener</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">

<div class="max-w-2xl mx-auto mt-20 bg-white p-8 rounded shadow">

    <h1 class="text-2xl font-bold mb-4">Laravel URL Shortener</h1>

    <form method="POST" action="/shorten" class="flex gap-2">
        @csrf
        <input type="text" name="url" 
            class="border p-2 flex-1 rounded"
            placeholder="Masukkan URL panjang" required>
        <button class="bg-blue-500 text-white px-4 rounded">
            Shorten
        </button>
    </form>

    @if(session('success'))
        <div class="mt-4 p-3 bg-green-100 rounded">
            Short URL: 
            <a href="{{ session('success') }}" 
               class="text-blue-600 underline" target="_blank">
               {{ session('success') }}
            </a>
        </div>
    @endif

    <h2 class="mt-6 font-bold">Daftar URL</h2>
    <table class="w-full mt-2 border">
        <tr class="bg-gray-200">
            <th class="p-2">Short</th>
            <th class="p-2">Original</th>
            <th class="p-2">Clicks</th>
        </tr>
        @foreach($urls as $u)
        <tr class="border-t">
            <td class="p-2">
                <a href="{{ url($u->short_code) }}" 
                   class="text-blue-600 underline" target="_blank">
                   {{ url($u->short_code) }}
                </a>
            </td>
            <td class="p-2 truncate max-w-xs">
                {{ $u->original_url }}
            </td>
            <td class="p-2 text-center">
                {{ $u->clicks }}
            </td>
        </tr>
        @endforeach
    </table>

</div>

</body>
</html>
