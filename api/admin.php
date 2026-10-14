<?php
// Действия в панели: заявки, сводка, новости, пользователи, журнал. Права — по роли (см. PERMS в lib.php).
declare(strict_types=1);
require __DIR__ . '/lib.php';

const STATUSES = ['new', 'work', 'planned', 'done', 'rejected'];
const CATS = ['project', 'eyes'];
const STATUS_LABELS = ['new' => 'Новая', 'work' => 'В работе', 'planned' => 'Выезд запланирован', 'done' => 'Проведено', 'rejected' => 'Отклонена'];
const ROLE_LABELS = ['superadmin' => 'главный администратор', 'coordinator' => 'координатор', 'editor' => 'редактор новостей', 'viewer' => 'наблюдатель'];
$action = $_GET['action'] ?? '';
$pdo = db();

// ---------- Заявки ----------
if ($action === 'requests') {
    require_method('GET');
    require_admin(false, 'requests.view');
    cleanup_old_requests();
    $rows = $pdo->query('SELECT id, created_at, name, phone, email, district, school, ages, comment, status FROM requests ORDER BY created_at DESC')->fetchAll();
    json_out(['ok' => true, 'requests' => $rows]);
}
if ($action === 'status') {
    require_method('POST');
    $a = require_admin(true, 'requests.edit');
    $d = body();
    if (!in_array($d['status'] ?? '', STATUSES, true)) fail(422, 'Неизвестный статус.');
    $pdo->prepare('UPDATE requests SET status = ? WHERE id = ?')->execute([$d['status'], (int)($d['id'] ?? 0)]);
    audit($a, 'request_status', 'Заявка #' . (int)($d['id'] ?? 0) . ' → ' . STATUS_LABELS[$d['status']]);
    json_out(['ok' => true]);
}
if ($action === 'delete_request') {
    require_method('POST');
    $a = require_admin(true, 'requests.delete');
    $id = (int)(body()['id'] ?? 0);
    $pdo->prepare('DELETE FROM requests WHERE id = ?')->execute([$id]);
    audit($a, 'request_delete', 'Заявка #' . $id);
    json_out(['ok' => true]);
}

if ($action === 'export') {
    require_method('GET');
    $a = require_admin(false, 'requests.export');
    require __DIR__ . '/xlsx.php';
    cleanup_old_requests();
    $rows = [];
    foreach ($pdo->query('SELECT created_at, school, district, ages, name, phone, email, comment, status FROM requests ORDER BY created_at DESC') as $r) {
        $rows[] = [gmdate('d.m.Y H:i', strtotime($r['created_at'] . ' UTC') + 3 * 3600), $r['school'], $r['district'], $r['ages'],
            $r['name'], $r['phone'], $r['email'], $r['comment'], STATUS_LABELS[$r['status']] ?? $r['status']];
    }
    $file = xlsx_build(['Дата (МСК)', 'Школа', 'Район', 'Возраст детей', 'Имя', 'Телефон', 'Email', 'Комментарий', 'Статус'],
        $rows, [16, 24, 18, 18, 16, 18, 24, 40, 18], 'Заявки');
    audit($a, 'requests_export', 'Строк: ' . count($rows));
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="zayavki-bpz-' . gmdate('Y-m-d') . '.xlsx"');
    header('Cache-Control: no-store');
    header('Content-Length: ' . strlen($file));
    echo $file;
    exit;
}

// ---------- Сводка: только агрегаты, без контактов ----------
if ($action === 'summary') {
    require_method('GET');
    require_admin(false, 'summary.view');
    cleanup_old_requests();
    $byStatus = array_fill_keys(STATUSES, 0);
    foreach ($pdo->query('SELECT status, COUNT(*) AS n FROM requests GROUP BY status') as $r) $byStatus[$r['status']] = (int)$r['n'];
    $schools = $pdo->query("SELECT MIN(school) AS school, MIN(district) AS district, COUNT(*) AS n,
        SUM(CASE WHEN status IN ('new', 'work') THEN 1 ELSE 0 END) AS open
        FROM requests GROUP BY LOWER(TRIM(school)), district ORDER BY n DESC")->fetchAll();
    foreach ($schools as &$s) { $s['n'] = (int)$s['n']; $s['open'] = (int)$s['open']; }
    json_out(['ok' => true, 'total' => array_sum($byStatus), 'byStatus' => $byStatus, 'schools' => $schools]);
}

// ---------- Новости ----------
if ($action === 'add_news') {
    require_method('POST');
    $a = require_admin(true, 'news.manage');
    $d = body();
    $title = str($d, 'title', 200);
    $url = str($d, 'url', 500);
    $cat = in_array($d['cat'] ?? '', CATS, true) ? $d['cat'] : 'project';
    if ($title === '') fail(422, 'Укажите заголовок.');
    if ($url !== '' && !preg_match('~^https?://~i', $url)) fail(422, 'Ссылка должна начинаться с https://');
    $pdo->prepare('INSERT INTO news (created_at, cat, title, text, url) VALUES (?, ?, ?, ?, ?)')
        ->execute([now(), $cat, $title, str($d, 'text', 1000), $url]);
    audit($a, 'news_add', $title);
    json_out(['ok' => true]);
}
if ($action === 'delete_news') {
    require_method('POST');
    $a = require_admin(true, 'news.manage');
    $id = (int)(body()['id'] ?? 0);
    $st = $pdo->prepare('SELECT title FROM news WHERE id = ?');
    $st->execute([$id]);
    $pdo->prepare('DELETE FROM news WHERE id = ?')->execute([$id]);
    audit($a, 'news_delete', (string)$st->fetchColumn());
    json_out(['ok' => true]);
}

// ---------- Пользователи (только главный администратор) ----------
function active_superadmins(PDO $pdo): int {
    return (int)$pdo->query("SELECT COUNT(*) FROM admins WHERE role = 'superadmin' AND active = 1")->fetchColumn();
}
function find_user(PDO $pdo, int $id): array {
    $st = $pdo->prepare('SELECT id, login, name, role, active FROM admins WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) fail(404, 'Пользователь не найден.');
    return $u;
}

if ($action === 'users') {
    require_method('GET');
    require_admin(false, 'users.manage');
    $rows = $pdo->query('SELECT id, login, name, role, active, created_at FROM admins ORDER BY created_at')->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['active'] = (bool)(int)$r['active']; }
    json_out(['ok' => true, 'users' => $rows]);
}
if ($action === 'create_user') {
    require_method('POST');
    $a = require_admin(true, 'users.manage');
    $d = body();
    $login = str($d, 'login', 60);
    $role = (string)($d['role'] ?? '');
    $pass = (string)($d['password'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9_.-]{3,60}$/', $login)) fail(422, 'Логин: 3–60 латинских букв, цифр, точек, дефисов.');
    if (!in_array($role, ROLES, true)) fail(422, 'Выберите роль.');
    if (mb_strlen($pass) < 12) fail(422, 'Временный пароль — не короче 12 символов.');
    $st = $pdo->prepare('SELECT COUNT(*) FROM admins WHERE login = ?');
    $st->execute([$login]);
    if ((int)$st->fetchColumn() > 0) fail(422, 'Такой логин уже есть.');
    $pdo->prepare('INSERT INTO admins (login, pass_hash, created_at, name, role, active) VALUES (?, ?, ?, ?, ?, 1)')
        ->execute([$login, password_hash($pass, PASSWORD_DEFAULT), now(), str($d, 'name', 100), $role]);
    audit($a, 'user_create', "$login (" . ROLE_LABELS[$role] . ")");
    json_out(['ok' => true]);
}
if ($action === 'update_user') {
    require_method('POST');
    $a = require_admin(true, 'users.manage');
    $d = body();
    $u = find_user($pdo, (int)($d['id'] ?? 0));
    $role = array_key_exists('role', $d) ? (string)$d['role'] : $u['role'];
    $active = array_key_exists('active', $d) ? (bool)$d['active'] : (bool)(int)$u['active'];
    if (!in_array($role, ROLES, true)) fail(422, 'Неизвестная роль.');
    if ((int)$u['id'] === $a['id'] && ($role !== 'superadmin' || !$active)) fail(422, 'Нельзя понизить или отключить самого себя.');
    $losesSuper = $u['role'] === 'superadmin' && (int)$u['active'] && ($role !== 'superadmin' || !$active);
    if ($losesSuper && active_superadmins($pdo) <= 1) fail(422, 'Должен остаться хотя бы один активный главный администратор.');
    $pdo->prepare('UPDATE admins SET role = ?, active = ? WHERE id = ?')->execute([$role, $active ? 1 : 0, $u['id']]);
    audit($a, 'user_update', "{$u['login']}: " . ROLE_LABELS[$role] . ', ' . ($active ? 'активен' : 'отключён'));
    json_out(['ok' => true]);
}
if ($action === 'reset_password') {
    require_method('POST');
    $a = require_admin(true, 'users.manage');
    $d = body();
    $u = find_user($pdo, (int)($d['id'] ?? 0));
    $pass = (string)($d['password'] ?? '');
    if (mb_strlen($pass) < 12) fail(422, 'Новый пароль — не короче 12 символов.');
    $pdo->prepare('UPDATE admins SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
    audit($a, 'user_password_reset', $u['login']);
    json_out(['ok' => true]);
}

// ---------- Журнал действий ----------
if ($action === 'audit') {
    require_method('GET');
    require_admin(false, 'audit.view');
    $rows = $pdo->query('SELECT created_at, admin_login, action, details FROM audit ORDER BY id DESC LIMIT 300')->fetchAll();
    json_out(['ok' => true, 'audit' => $rows]);
}

fail(404, 'Неизвестное действие.');
