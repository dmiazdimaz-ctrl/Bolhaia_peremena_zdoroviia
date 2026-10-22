#!/usr/bin/env bash
# Установка и обновление сайта «Большая перемена здоровья» на VPS (Ubuntu 22.04/24.04, Debian 12).
#
# Первая установка (без --domain — по IP и без HTTPS, только для проверки):
#   sudo bash install.sh --domain bpz36.ru --email coordinator@bpz36.ru \
#        --smtp-host smtp.yandex.ru --smtp-user noreply@bpz36.ru --smtp-pass 'ПАРОЛЬ_ПРИЛОЖЕНИЯ'
# Обновление сайта до последней версии из GitHub (настройки и база сохраняются):
#   sudo bash install.sh --update
#
# Что делает: nginx + PHP-FPM + MariaDB, HTTPS (Let's Encrypt), файрвол ufw, fail2ban,
# автоматические обновления безопасности, ежедневный бэкап базы, отправка почты через SMTP,
# создание главного администратора.
set -euo pipefail

REPO="https://github.com/dmiazdimaz-ctrl/Bolhaia_peremena_zdoroviia.git"
BRANCH="main"
APP_DIR="/var/www/bpz"
DB_NAME="bpz"
DB_USER="bpz"
DOMAIN="" EMAIL="" SMTP_HOST="" SMTP_PORT="587" SMTP_USER="" SMTP_PASS="" ADMIN_LOGIN="admin" UPDATE=0

# setup.php через PHP CLI: создаёт/обновляет таблицы; run_setup ЛОГИН ПАРОЛЬ — ещё и главного администратора.
run_setup() {
  (cd "$APP_DIR/api" && SETUP_LOGIN="${1:-}" SETUP_PASS="${2:-}" php -d display_errors=stderr -r '
    $_SERVER["REQUEST_METHOD"] = getenv("SETUP_PASS") ? "POST" : "GET";
    $_POST = ["name" => "Главный администратор", "login" => getenv("SETUP_LOGIN"), "password" => getenv("SETUP_PASS")];
    include "setup.php";')
}

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --smtp-host) SMTP_HOST="$2"; shift 2 ;;
    --smtp-port) SMTP_PORT="$2"; shift 2 ;;
    --smtp-user) SMTP_USER="$2"; shift 2 ;;
    --smtp-pass) SMTP_PASS="$2"; shift 2 ;;
    --admin) ADMIN_LOGIN="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --update) UPDATE=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) die "Неизвестный параметр: $1 (см. --help)" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "Запустите через sudo."
. /etc/os-release
case "${ID:-}" in ubuntu|debian) ;; *) die "Поддерживаются Ubuntu и Debian, у вас: ${PRETTY_NAME:-неизвестно}." ;; esac

# ---------- Обновление ----------
if [ "$UPDATE" -eq 1 ]; then
  [ -d "$APP_DIR/.git" ] || die "Сайт ещё не установлен в $APP_DIR."
  say "Обновляю сайт из GitHub ($BRANCH)"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
  chown -R root:www-data "$APP_DIR"; chmod -R g-w,o-w "$APP_DIR"
  chmod 640 "$APP_DIR/api/config.php"
  # Новые таблицы/колонки, если они появились в новой версии.
  run_setup >/dev/null || warn "Миграция базы не выполнилась — см. вывод выше."
  PHPV="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
  systemctl reload "php${PHPV}-fpm" nginx
  say "Готово: $(git -C "$APP_DIR" log --oneline -1)"
  exit 0
fi

[ -n "$EMAIL" ] || die "Укажите почту координатора для заявок и Let's Encrypt: --email ..."
if [ -z "$DOMAIN" ]; then
  warn "Домен не указан: сайт будет работать по IP и БЕЗ HTTPS — только для проверки."
  warn "Реальные заявки с персональными данными по HTTP принимать нельзя. Когда будет домен, перезапустите с --domain."
fi

# ---------- Пакеты ----------
say "Устанавливаю пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx mariadb-server php-fpm php-cli php-mysql php-mbstring php-xml \
  certbot python3-certbot-nginx ufw fail2ban unattended-upgrades git curl openssl msmtp-mta ca-certificates >/dev/null
PHPV="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
php -r 'exit(version_compare(PHP_VERSION, "8.1", ">=") ? 0 : 1);' || die "Нужен PHP 8.1+, установлен $PHPV. Используйте Ubuntu 22.04+ или Debian 12."
FPM_SOCK="/run/php/php${PHPV}-fpm.sock"

# ---------- Безопасность сервера ----------
say "Файрвол, fail2ban, автообновления"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
sed -i 's/^expose_php = On/expose_php = Off/' "/etc/php/$PHPV/fpm/php.ini"

# ---------- Код сайта ----------
say "Загружаю сайт из GitHub"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH" && git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

# ---------- База данных ----------
CONFIG="$APP_DIR/api/config.php"
if [ ! -f "$CONFIG" ]; then
  say "Создаю базу данных и config.php"
  DB_PASS="$(openssl rand -hex 24)"
  SECRET="$(openssl rand -hex 32)"
  mysql -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
            ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
            GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"
  cat > "$CONFIG" <<PHP
<?php
// Создано deploy/install.sh $(date +%F). Не хранится в git.
return [
    'db_dsn'  => 'mysql:host=localhost;dbname=$DB_NAME;charset=utf8mb4',
    'db_user' => '$DB_USER',
    'db_pass' => '$DB_PASS',
    'notify_email' => '$EMAIL',
    'mail_from'    => '${SMTP_USER:-noreply@${DOMAIN:-localhost}}',
    'secret' => '$SECRET',
    'retention_days' => 365,
];
PHP
fi
chown -R root:www-data "$APP_DIR"
chmod -R g-w,o-w "$APP_DIR"
chmod 640 "$CONFIG"

# ---------- Почта (SMTP через msmtp — PHP mail() отправляет через него) ----------
if [ -n "$SMTP_HOST" ]; then
  say "Настраиваю отправку почты через $SMTP_HOST"
  [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ] || die "Для SMTP нужны --smtp-user и --smtp-pass."
  cat > /etc/msmtprc <<MSMTP
defaults
auth on
tls on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile /var/log/msmtp.log
account default
host $SMTP_HOST
port $SMTP_PORT
from $SMTP_USER
user $SMTP_USER
password $SMTP_PASS
MSMTP
  chown root:www-data /etc/msmtprc; chmod 640 /etc/msmtprc
  touch /var/log/msmtp.log; chown www-data:adm /var/log/msmtp.log; chmod 640 /var/log/msmtp.log
else
  warn "SMTP не указан: письма о заявках отправляться не будут (заявки всё равно сохраняются в панели)."
  warn "Добавить позже: перезапустите скрипт с --smtp-host --smtp-user --smtp-pass."
fi

# ---------- nginx ----------
say "Настраиваю nginx"
cat > /etc/nginx/sites-available/bpz <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN:-_}${DOMAIN:+ www.$DOMAIN};
    root $APP_DIR;
    index index.html;
    client_max_body_size 1m;
    server_tokens off;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "same-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Служебное: git, конфиги, документация, тестовые данные.
    location ~ /\.(?!well-known) { deny all; }
    location ~ ^/(deploy|api/data)/ { deny all; }
    location ~ ^/api/(config|config\.sample|lib|xlsx)\.php$ { deny all; }
    location ~ \.md$ { deny all; }

    # Первичная настройка выполняется из командной строки сервера, снаружи закрыта.
    location = /api/setup.php { deny all; }
    location ~ ^/api/[a-z_]+\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$FPM_SOCK;
    }
    location ~ \.php$ { deny all; }

    location / { try_files \$uri \$uri/ =404; }
}
NGINX
ln -sf /etc/nginx/sites-available/bpz /etc/nginx/sites-enabled/bpz
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl enable --now "php${PHPV}-fpm" nginx mariadb >/dev/null 2>&1
systemctl reload "php${PHPV}-fpm" nginx

# ---------- Таблицы и главный администратор ----------
say "Создаю таблицы и главного администратора"
ADMIN_PASS=""
SETUP_OUT="$(run_setup)" || die "Не удалось создать таблицы: $SETUP_OUT"
if printf '%s' "$SETUP_OUT" | grep -q 'name="login"'; then
  ADMIN_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
  SETUP_OUT="$(run_setup "$ADMIN_LOGIN" "$ADMIN_PASS")"
  printf '%s' "$SETUP_OUT" | grep -q 'администратор добавлен' || die "Не удалось создать администратора."
else
  warn "Главный администратор уже существует — пароль не менялся."
fi

# ---------- HTTPS ----------
SCHEME="http"
if [ -n "$DOMAIN" ]; then
say "Получаю сертификат Let's Encrypt"
if certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" >/dev/null 2>&1 \
   || certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN" >/dev/null 2>&1; then
  SCHEME="https"
else
  SCHEME="http"
  warn "Сертификат не получен: проверьте, что DNS-запись A для $DOMAIN указывает на этот сервер, и перезапустите скрипт."
fi
fi
HOST="${DOMAIN:-$(curl -fsS -m 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

# ---------- Бэкапы ----------
say "Ежедневный бэкап базы в /var/backups/bpz (хранится 14 дней)"
mkdir -p /var/backups/bpz && chmod 700 /var/backups/bpz
cat > /etc/cron.daily/bpz-backup <<'CRON'
#!/bin/sh
mysqldump --single-transaction bpz | gzip > /var/backups/bpz/bpz-$(date +%F).sql.gz
find /var/backups/bpz -name '*.sql.gz' -mtime +14 -delete
CRON
chmod 755 /etc/cron.daily/bpz-backup

# ---------- Итог ----------
say "Готово"
echo "Сайт:   $SCHEME://$HOST"
echo "Вход:   $SCHEME://$HOST/login.html"
if [ -n "$ADMIN_PASS" ]; then
  echo "Логин:  $ADMIN_LOGIN"
  echo "Пароль: $ADMIN_PASS"
  warn "Сохраните пароль и смените его после входа (вкладка «Учётная запись»). Он больше нигде не показывается."
fi
echo "Обновление сайта: sudo bash $APP_DIR/deploy/install.sh --update"
