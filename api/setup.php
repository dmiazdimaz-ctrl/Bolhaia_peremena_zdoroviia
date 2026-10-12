<?php
// Первичная настройка: создаёт таблицы и первого администратора.
// Работает, только пока в базе нет ни одного администратора. После настройки удалите этот файл.
declare(strict_types=1);
require __DIR__ . '/lib.php';
set_exception_handler(null);

$pdo = db();
$mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
$id = $mysql ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$tail = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
foreach ([
    "CREATE TABLE IF NOT EXISTS requests (id $id, created_at DATETIME NOT NULL, name VARCHAR(100) NOT NULL, phone VARCHAR(30) NOT NULL,
       email VARCHAR(120) NOT NULL DEFAULT '', district VARCHAR(60) NOT NULL DEFAULT '', school VARCHAR(150) NOT NULL,
       ages VARCHAR(100) NOT NULL DEFAULT '', comment VARCHAR(1000) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'new')$tail",
    "CREATE TABLE IF NOT EXISTS news (id $id, created_at DATETIME NOT NULL, cat VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL,
       text VARCHAR(1000) NOT NULL DEFAULT '', url VARCHAR(500) NOT NULL DEFAULT '')$tail",
    "CREATE TABLE IF NOT EXISTS admins (id $id, login VARCHAR(60) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL,
       name VARCHAR(100) NOT NULL DEFAULT '', role VARCHAR(20) NOT NULL DEFAULT 'viewer', active SMALLINT NOT NULL DEFAULT 1)$tail",
    "CREATE TABLE IF NOT EXISTS audit (id $id, created_at DATETIME NOT NULL, admin_login VARCHAR(60) NOT NULL, action VARCHAR(40) NOT NULL,
       details VARCHAR(500) NOT NULL DEFAULT '')$tail",
    "CREATE TABLE IF NOT EXISTS hits (id $id, kind VARCHAR(20) NOT NULL, client CHAR(64) NOT NULL, created_at DATETIME NOT NULL)$tail",
] as $sql) $pdo->exec($sql);

// Миграция базы, созданной до появления ролей: добавить колонки, прежних админов сделать главными.
try { $pdo->query('SELECT role FROM admins LIMIT 1'); } catch (PDOException $e) {
    $pdo->exec("ALTER TABLE admins ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT ''");
    $pdo->exec("ALTER TABLE admins ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'viewer'");
    $pdo->exec("ALTER TABLE admins ADD COLUMN active SMALLINT NOT NULL DEFAULT 1");
    $pdo->exec("UPDATE admins SET role = 'superadmin'");
}

$hasAdmin = (int)$pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0;
$msg = '';
if (!$hasAdmin && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim((string)($_POST['login'] ?? ''));
    $name = mb_substr(trim((string)($_POST['name'] ?? '')), 0, 100);
    $pass = (string)($_POST['password'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9_.-]{3,60}$/', $login)) $msg = 'Логин: 3–60 латинских букв, цифр, точек, дефисов.';
    elseif (mb_strlen($pass) < 12) $msg = 'Пароль должен быть не короче 12 символов.';
    else {
        $pdo->prepare('INSERT INTO admins (login, pass_hash, created_at, name, role, active) VALUES (?, ?, ?, ?, ?, 1)')
            ->execute([$login, password_hash($pass, PASSWORD_DEFAULT), now(), $name, 'superadmin']);
        audit(['login' => $login], 'setup', 'Создан главный администратор');
        $hasAdmin = true;
        $msg = 'ok';
    }
}
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Настройка · БПЗ</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px}
label{display:block;margin:12px 0}input{width:100%;padding:8px;font:inherit;box-sizing:border-box}button{padding:10px 18px;font:inherit}
.ok{background:#e6f5ef;padding:12px;border-radius:8px}.err{background:#fde8e6;padding:12px;border-radius:8px}</style></head><body>
<h1>Настройка сайта БПЗ</h1>
<?php if ($msg === 'ok'): ?>
  <p class="ok">Таблицы созданы, администратор добавлен. <b>Удалите файл api/setup.php с хостинга</b> и войдите на странице <a href="../login.html">входа</a>.</p>
<?php elseif ($hasAdmin): ?>
  <p class="ok">Сайт уже настроен. Удалите файл api/setup.php с хостинга.</p>
<?php else: ?>
  <p>Таблицы созданы. Создайте учётную запись главного администратора — он сможет добавлять остальных пользователей.</p>
  <?php if ($msg): ?><p class="err"><?= htmlspecialchars($msg) ?></p><?php endif; ?>
  <form method="post">
    <label>Имя <input name="name" autocomplete="name"></label>
    <label>Логин <input name="login" required autocomplete="username"></label>
    <label>Пароль (от 12 символов) <input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
    <button type="submit">Создать</button>
  </form>
<?php endif; ?>
</body></html>
