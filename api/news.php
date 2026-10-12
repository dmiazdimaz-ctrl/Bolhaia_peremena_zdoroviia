<?php
// Публичный список новостей, добавленных координатором.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_method('GET');
$rows = db()->query('SELECT id, created_at, cat, title, text, url FROM news ORDER BY created_at DESC LIMIT 50')->fetchAll();
json_out(['ok' => true, 'news' => $rows]);
