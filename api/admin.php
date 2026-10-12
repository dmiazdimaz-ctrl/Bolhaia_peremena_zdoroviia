<?php
// Действия администратора: заявки и новости.
declare(strict_types=1);
require __DIR__ . '/lib.php';

const STATUSES = ['new', 'work', 'planned', 'done', 'rejected'];
const CATS = ['project', 'eyes'];
$action = $_GET['action'] ?? '';
$pdo = db();

if ($action === 'requests') {
    require_method('GET');
    require_admin();
    cleanup_old_requests();
    $rows = $pdo->query('SELECT id, created_at, name, phone, email, district, school, ages, comment, status FROM requests ORDER BY created_at DESC')->fetchAll();
    json_out(['ok' => true, 'requests' => $rows]);
}
if ($action === 'status') {
    require_method('POST');
    require_admin(true);
    $d = body();
    if (!in_array($d['status'] ?? '', STATUSES, true)) fail(422, 'Неизвестный статус.');
    $pdo->prepare('UPDATE requests SET status = ? WHERE id = ?')->execute([$d['status'], (int)($d['id'] ?? 0)]);
    json_out(['ok' => true]);
}
if ($action === 'delete_request') {
    require_method('POST');
    require_admin(true);
    $pdo->prepare('DELETE FROM requests WHERE id = ?')->execute([(int)(body()['id'] ?? 0)]);
    json_out(['ok' => true]);
}
if ($action === 'add_news') {
    require_method('POST');
    require_admin(true);
    $d = body();
    $title = str($d, 'title', 200);
    $url = str($d, 'url', 500);
    $cat = in_array($d['cat'] ?? '', CATS, true) ? $d['cat'] : 'project';
    if ($title === '') fail(422, 'Укажите заголовок.');
    if ($url !== '' && !preg_match('~^https?://~i', $url)) fail(422, 'Ссылка должна начинаться с https://');
    $pdo->prepare('INSERT INTO news (created_at, cat, title, text, url) VALUES (?, ?, ?, ?, ?)')
        ->execute([now(), $cat, $title, str($d, 'text', 1000), $url]);
    json_out(['ok' => true]);
}
if ($action === 'delete_news') {
    require_method('POST');
    require_admin(true);
    $pdo->prepare('DELETE FROM news WHERE id = ?')->execute([(int)(body()['id'] ?? 0)]);
    json_out(['ok' => true]);
}
fail(404, 'Неизвестное действие.');
