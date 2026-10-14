<?php
// Общие функции API: конфиг, БД, ответы, сессия администратора, защита от спама.
declare(strict_types=1);

function config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) fail(500, 'Сервер не настроен: нет api/config.php.');
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function json_out(array $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $message): never {
    json_out(['ok' => false, 'error' => $message], $code);
}

function require_method(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) fail(405, 'Метод не поддерживается.');
}

function body(): array {
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) fail(400, 'Неверный формат запроса.');
    return $data;
}

function str(array $d, string $key, int $max): string {
    $v = trim((string)($d[$key] ?? ''));
    return mb_substr(preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v) ?? '', 0, $max);
}

function now(): string { return gmdate('Y-m-d H:i:s'); }

// Ключ клиента для ограничения частоты: хеш IP с секретом, сам IP не хранится.
function client_key(): string {
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . config()['secret']);
}

// Не больше $limit событий $kind с одного адреса за $window секунд.
function rate_limit(string $kind, int $limit, int $window): void {
    $pdo = db();
    $since = gmdate('Y-m-d H:i:s', time() - $window);
    $pdo->prepare('DELETE FROM hits WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM hits WHERE kind = ? AND client = ? AND created_at >= ?');
    $st->execute([$kind, client_key(), $since]);
    if ((int)$st->fetchColumn() >= $limit) fail(429, 'Слишком много попыток. Попробуйте позже.');
}

function hit(string $kind): void {
    db()->prepare('INSERT INTO hits (kind, client, created_at) VALUES (?, ?, ?)')->execute([$kind, client_key(), now()]);
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('bpz_admin');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
    ]);
    session_start();
    // Сессия живёт 8 часов без активности.
    if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > 8 * 3600) { $_SESSION = []; session_regenerate_id(true); }
    $_SESSION['seen'] = time();
}

// Роли и права. Проверяются на сервере при каждом запросе; интерфейс лишь прячет недоступное.
const ROLES = ['superadmin', 'coordinator', 'editor', 'viewer'];
const PERMS = [
    'requests.view'   => ['superadmin', 'coordinator'],
    'requests.edit'   => ['superadmin', 'coordinator'],
    'requests.delete' => ['superadmin'],
    'requests.export' => ['superadmin', 'coordinator'],
    'summary.view'    => ['superadmin', 'coordinator', 'editor', 'viewer'],
    'news.manage'     => ['superadmin', 'coordinator', 'editor'],
    'users.manage'    => ['superadmin'],
    'audit.view'      => ['superadmin'],
];

function can(string $role, string $perm): bool {
    return in_array($role, PERMS[$perm] ?? [], true);
}

// Текущий пользователь берётся из БД на каждый запрос: отключение и смена роли действуют сразу.
function current_admin(): ?array {
    start_session();
    if (!isset($_SESSION['admin_id'])) return null;
    $st = db()->prepare('SELECT id, login, name, role, active FROM admins WHERE id = ?');
    $st->execute([$_SESSION['admin_id']]);
    $a = $st->fetch();
    if (!$a || !(int)$a['active']) { $_SESSION = []; return null; }
    $a['id'] = (int)$a['id'];
    unset($a['active']);
    return $a;
}

// Для изменяющих запросов: сессия + CSRF-токен в заголовке; при $perm — ещё и право роли.
function require_admin(bool $write = false, ?string $perm = null): array {
    $a = current_admin();
    if (!$a) fail(401, 'Нужно войти.');
    if ($write && !hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail(403, 'Сессия устарела. Обновите страницу.');
    if ($perm && !can($a['role'], $perm)) fail(403, 'Недостаточно прав.');
    return $a;
}

function audit(?array $admin, string $action, string $details = ''): void {
    db()->prepare('INSERT INTO audit (created_at, admin_login, action, details) VALUES (?, ?, ?, ?)')
        ->execute([now(), $admin['login'] ?? '—', $action, mb_substr($details, 0, 500)]);
}

function cleanup_old_requests(): void {
    $days = (int)(config()['retention_days'] ?? 365);
    db()->prepare('DELETE FROM requests WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - $days * 86400)]);
}

function send_mail(string $to, string $subject, string $text): bool {
    $from = config()['mail_from'] ?? '';
    $headers = "From: $from\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $text, $headers, $from ? "-f$from" : '');
}

set_exception_handler(function (Throwable $e) {
    error_log('[bpz] ' . $e->getMessage());
    fail(500, 'Ошибка сервера. Попробуйте позже.');
});
