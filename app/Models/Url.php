<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Url extends Model
{
    protected $fillable = [
        'short_code',
        'original_url',
        'clicks'
    ];
}
