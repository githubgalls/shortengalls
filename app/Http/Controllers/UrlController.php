<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Url;
use Illuminate\Support\Str;

class UrlController extends Controller
{
    public function index()
    {
        $urls = Url::latest()->get();
        return view('welcome', compact('urls'));
    }

    public function shorten(Request $request)
    {
        $request->validate([
            'url' => 'required|url'
        ]);

        do {
            $short = Str::random(6);
        } while (Url::where('short_code', $short)->exists());

        $url = Url::create([
            'short_code' => $short,
            'original_url' => $request->url
        ]);

        return redirect('/')->with('success', url($url->short_code));
    }

    public function redirect($code)
    {
        $url = Url::where('short_code', $code)->firstOrFail();
        $url->increment('clicks');

        return redirect()->away($url->original_url);
    }
}
