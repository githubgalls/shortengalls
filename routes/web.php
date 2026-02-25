<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\UrlController;

Route::get('/', [UrlController::class, 'index']);
Route::post('/shorten', [UrlController::class, 'shorten']);
Route::get('/{code}', [UrlController::class, 'redirect']);
