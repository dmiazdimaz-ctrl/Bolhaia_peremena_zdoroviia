<?php
// Приём заявки родителей «Пригласить БПЗ в школу».
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_method('POST');
$d = body();

// Ловушка для ботов: скрытое поле должно остаться пустым.
if (str($d, 'website', 100) !== '') json_out(['ok' => true]);

rate_limit('request', 5, 3600);

$r = [
    'name' => str($d, 'name', 100), 'phone' => str($d, 'phone', 30), 'email' => str($d, 'email', 120),
    'district' => str($d, 'district', 60), 'school' => str($d, 'school', 150), 'comment' => str($d, 'comment', 1000),
    'ages' => mb_substr(implode(', ', array_map(fn($a) => mb_substr(trim((string)$a), 0, 20), array_slice((array)($d['ages'] ?? []), 0, 6))), 0, 100),
];
if ($r['name'] === '') fail(422, 'Укажите, как к вам обращаться.');
if (strlen(preg_replace('/\D/', '', $r['phone'])) < 10) fail(422, 'Проверьте телефон: нужно не меньше 10 цифр.');
if ($r['email'] !== '' && !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'Проверьте email.');
if ($r['school'] === '') fail(422, 'Укажите школу.');
if (($d['consent'] ?? false) !== true) fail(422, 'Нужно согласие на обработку контактов.');

hit('request');
db()->prepare('INSERT INTO requests (created_at, name, phone, email, district, school, ages, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([now(), $r['name'], $r['phone'], $r['email'], $r['district'], $r['school'], $r['ages'], $r['comment'], 'new']);

$to = config()['notify_email'] ?? '';
if ($to) {
    send_mail($to, 'БПЗ: новая заявка — ' . $r['school'],
        "Новая заявка на скрининг в школе.\n\nШкола: {$r['school']}\nРайон: {$r['district']}\nВозраст детей: {$r['ages']}\n" .
        "Имя: {$r['name']}\nТелефон: {$r['phone']}\nEmail: {$r['email']}\nКомментарий: {$r['comment']}\n\nВсе заявки — в панели администратора.");
}
json_out(['ok' => true]);
