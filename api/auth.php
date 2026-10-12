<?php
// Вход, выход и проверка сессии администратора.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';
if ($action === 'me') {
    require_method('GET');
    $a = current_admin();
    if (!$a) json_out(['ok' => true, 'admin' => null]);
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    json_out(['ok' => true, 'admin' => $a, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'login') {
    require_method('POST');
    rate_limit('login', 5, 900);
    $d = body();
    $st = db()->prepare('SELECT id, login, name, role, active, pass_hash FROM admins WHERE login = ?');
    $st->execute([str($d, 'login', 60)]);
    $row = $st->fetch();
    if (!$row || !password_verify((string)($d['password'] ?? ''), $row['pass_hash'])) {
        hit('login');
        audit(null, 'login_failed', 'Логин: ' . str($d, 'login', 60));
        fail(401, 'Неверный логин или пароль.');
    }
    if (!(int)$row['active']) fail(403, 'Учётная запись отключена. Обратитесь к главному администратору.');
    start_session();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int)$row['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $admin = ['id' => (int)$row['id'], 'login' => $row['login'], 'name' => $row['name'], 'role' => $row['role']];
    audit($admin, 'login');
    json_out(['ok' => true, 'admin' => $admin, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'logout') {
    require_method('POST');
    audit(require_admin(true), 'logout');
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}
if ($action === 'password') {
    require_method('POST');
    $a = require_admin(true);
    $d = body();
    $st = db()->prepare('SELECT pass_hash FROM admins WHERE id = ?');
    $st->execute([$a['id']]);
    if (!password_verify((string)($d['current'] ?? ''), (string)$st->fetchColumn())) fail(422, 'Текущий пароль указан неверно.');
    $new = (string)($d['new'] ?? '');
    if (mb_strlen($new) < 12) fail(422, 'Новый пароль должен быть не короче 12 символов.');
    db()->prepare('UPDATE admins SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $a['id']]);
    audit($a, 'password_change');
    json_out(['ok' => true]);
}
fail(404, 'Неизвестное действие.');
