// Слой данных сайта. На хостинге с PHP работает через api/, а там, где сервера нет
// (GitHub Pages, локальный файл, предпросмотр), — в демо-режиме на localStorage.
const DEMO_KEY = "bpz-demo-v5";
const DEMO_PASSWORD = "demo";

// Роли и права — те же, что PERMS в api/lib.php (сервер проверяет сам, здесь — для интерфейса).
const ROLE_NAMES = { superadmin: "Главный администратор", coordinator: "Координатор", editor: "Редактор новостей", viewer: "Наблюдатель" };
const PERMS = {
  "requests.view": ["superadmin", "coordinator"],
  "requests.edit": ["superadmin", "coordinator"],
  "requests.delete": ["superadmin"],
  "summary.view": ["superadmin", "coordinator", "editor", "viewer"],
  "news.manage": ["superadmin", "coordinator", "editor"],
  "users.manage": ["superadmin"],
  "audit.view": ["superadmin"],
};
const can = (user, perm) => !!user && (PERMS[perm] || []).includes(user.role);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
// "2026-10-12 09:30:00" (UTC) → "12.10.2026"
const fmtDate = (s) => { const d = new Date(String(s).replace(" ", "T") + "Z"); return isNaN(d) ? s : d.toLocaleDateString("ru-RU"); };
const fmtDateTime = (s) => { const d = new Date(String(s).replace(" ", "T") + "Z"); return isNaN(d) ? s : d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); };

// API считается доступным, если api/news.php отвечает JSON (даже с ошибкой настройки).
const apiReady = location.protocol === "file:" ? Promise.resolve(false)
  : fetch("api/news.php", { headers: { Accept: "application/json" } })
    .then((r) => (r.headers.get("Content-Type") || "").includes("application/json"))
    .catch(() => false);

let csrf = "";

async function call(path, { method = "GET", data } = {}) {
  const res = await fetch("api/" + path, {
    method, credentials: "same-origin",
    headers: { Accept: "application/json", ...(data ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  if (!res.ok || !json || !json.ok) throw new Error((json && json.error) || "Сервер недоступен. Попробуйте позже.");
  return json;
}

// ---------- Демо-режим ----------
const demo = {
  load() {
    try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    const t = "2026-10-01 08:00:00";
    return {
      session: null, news: [], nextId: 10, audit: [],
      users: [
        { id: 1, login: "admin", name: "Главный администратор", role: "superadmin", active: true, created_at: t },
        { id: 2, login: "coord", name: "Координатор проекта", role: "coordinator", active: true, created_at: t },
        { id: 3, login: "editor", name: "Пресс-служба", role: "editor", active: true, created_at: t },
        { id: 4, login: "viewer", name: "Минздрав ВО", role: "viewer", active: true, created_at: t },
      ],
      requests: [
        { id: 1, created_at: "2026-10-05 07:00:00", name: "Анна", phone: "+7 900 000-00-01", email: "", district: "Советский", school: "Школа № 12", ages: "7–8 лет, 9–10 лет", comment: "Готовы 15 родителей из 2А", status: "new" },
        { id: 2, created_at: "2026-10-07 09:00:00", name: "Игорь", phone: "+7 900 000-00-02", email: "", district: "Советский", school: "Школа № 12", ages: "11–12 лет", comment: "", status: "new" },
        { id: 3, created_at: "2026-10-08 11:00:00", name: "Марина", phone: "+7 900 000-00-03", email: "", district: "Левобережный", school: "Гимназия № 9", ages: "9–10 лет", comment: "", status: "planned" },
      ],
    };
  },
  save(s) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) {} },
  edit(fn) { const s = this.load(); const out = fn(s); this.save(s); return out; },
  me(s) { const u = s.users.find((x) => x.id === s.session && x.active); return u ? { id: u.id, login: u.login, name: u.name, role: u.role } : null; },
  // Та же проверка прав, что на сервере: без неё демо показывало бы лишнее.
  need(perm) {
    const s = this.load(), u = this.me(s);
    if (!u) throw new Error("Нужно войти.");
    if (!can(u, perm)) throw new Error("Недостаточно прав.");
    return u;
  },
  log(s, action, details = "") { const u = this.me(s); s.audit.unshift({ created_at: nowIso(), admin_login: u ? u.login : "—", action, details }); s.audit = s.audit.slice(0, 300); },
};

const Store = {
  isDemo: async () => !(await apiReady),

  async submitRequest(r) {
    if (await apiReady) return call("request.php", { method: "POST", data: r });
    demo.edit((s) => s.requests.unshift({ id: s.nextId++, created_at: nowIso(), ...r, ages: (r.ages || []).join(", "), status: "new" }));
  },

  async listNews() {
    if (await apiReady) { try { return (await call("news.php")).news; } catch (e) { return []; } }
    return demo.load().news;
  },

  // ----- вход -----
  async me() {
    if (await apiReady) { const r = await call("auth.php?action=me"); csrf = r.csrf || ""; return r.admin; }
    return demo.me(demo.load());
  },
  async login(login, password) {
    if (await apiReady) { const r = await call("auth.php?action=login", { method: "POST", data: { login, password } }); csrf = r.csrf; return r.admin; }
    return demo.edit((s) => {
      const u = s.users.find((x) => x.login === login);
      if (!u || password !== DEMO_PASSWORD) throw new Error("Неверный логин или пароль.");
      if (!u.active) throw new Error("Учётная запись отключена. Обратитесь к главному администратору.");
      s.session = u.id; demo.log(s, "login");
      return demo.me(s);
    });
  },
  async logout() {
    if (await apiReady) return call("auth.php?action=logout", { method: "POST", data: {} });
    demo.edit((s) => { demo.log(s, "logout"); s.session = null; });
  },
  async changePassword(current, next) {
    if (await apiReady) return call("auth.php?action=password", { method: "POST", data: { current, new: next } });
    throw new Error("В демо-режиме пароль не меняется.");
  },

  // ----- заявки и сводка -----
  async requests() {
    if (await apiReady) return (await call("admin.php?action=requests")).requests;
    demo.need("requests.view");
    return demo.load().requests;
  },
  async setStatus(id, status) {
    if (await apiReady) return call("admin.php?action=status", { method: "POST", data: { id, status } });
    demo.need("requests.edit");
    demo.edit((s) => { s.requests.find((r) => r.id === id).status = status; demo.log(s, "request_status", `Заявка #${id} → ${({ new: "Новая", work: "В работе", planned: "Выезд запланирован", done: "Проведено", rejected: "Отклонена" })[status]}`); });
  },
  async deleteRequest(id) {
    if (await apiReady) return call("admin.php?action=delete_request", { method: "POST", data: { id } });
    demo.need("requests.delete");
    demo.edit((s) => { s.requests = s.requests.filter((r) => r.id !== id); demo.log(s, "request_delete", `Заявка #${id}`); });
  },
  async summary() {
    if (await apiReady) return call("admin.php?action=summary");
    demo.need("summary.view");
    const reqs = demo.load().requests, byStatus = { new: 0, work: 0, planned: 0, done: 0, rejected: 0 }, m = {};
    reqs.forEach((r) => {
      byStatus[r.status]++;
      const k = (r.school.trim() + "|" + r.district).toLowerCase();
      const g = (m[k] = m[k] || { school: r.school, district: r.district, n: 0, open: 0 });
      g.n++; if (r.status === "new" || r.status === "work") g.open++;
    });
    return { total: reqs.length, byStatus, schools: Object.values(m).sort((a, b) => b.n - a.n) };
  },

  // ----- новости -----
  async addNews(n) {
    if (await apiReady) return call("admin.php?action=add_news", { method: "POST", data: n });
    demo.need("news.manage");
    if (!n.title) throw new Error("Укажите заголовок.");
    if (n.url && !/^https?:\/\//i.test(n.url)) throw new Error("Ссылка должна начинаться с https://");
    demo.edit((s) => { s.news.unshift({ id: s.nextId++, created_at: nowIso(), ...n }); demo.log(s, "news_add", n.title); });
  },
  async deleteNews(id) {
    if (await apiReady) return call("admin.php?action=delete_news", { method: "POST", data: { id } });
    demo.need("news.manage");
    demo.edit((s) => { const n = s.news.find((x) => x.id === id); s.news = s.news.filter((x) => x.id !== id); demo.log(s, "news_delete", n ? n.title : ""); });
  },

  // ----- пользователи и журнал -----
  async users() {
    if (await apiReady) return (await call("admin.php?action=users")).users;
    demo.need("users.manage");
    return demo.load().users;
  },
  async createUser(u) {
    if (await apiReady) return call("admin.php?action=create_user", { method: "POST", data: u });
    demo.need("users.manage");
    if (!/^[a-zA-Z0-9_.-]{3,60}$/.test(u.login)) throw new Error("Логин: 3–60 латинских букв, цифр, точек, дефисов.");
    if (!ROLE_NAMES[u.role]) throw new Error("Выберите роль.");
    if ((u.password || "").length < 12) throw new Error("Временный пароль — не короче 12 символов.");
    demo.edit((s) => {
      if (s.users.some((x) => x.login === u.login)) throw new Error("Такой логин уже есть.");
      s.users.push({ id: s.nextId++, login: u.login, name: u.name, role: u.role, active: true, created_at: nowIso() });
      demo.log(s, "user_create", `${u.login} (${ROLE_NAMES[u.role].toLowerCase()})`);
    });
  },
  async updateUser(id, patch) {
    if (await apiReady) return call("admin.php?action=update_user", { method: "POST", data: { id, ...patch } });
    const me = demo.need("users.manage");
    demo.edit((s) => {
      const u = s.users.find((x) => x.id === id);
      const role = patch.role ?? u.role, active = patch.active ?? u.active;
      if (u.id === me.id && (role !== "superadmin" || !active)) throw new Error("Нельзя понизить или отключить самого себя.");
      const supers = s.users.filter((x) => x.role === "superadmin" && x.active).length;
      if (u.role === "superadmin" && u.active && (role !== "superadmin" || !active) && supers <= 1) throw new Error("Должен остаться хотя бы один активный главный администратор.");
      Object.assign(u, { role, active });
      demo.log(s, "user_update", `${u.login}: ${ROLE_NAMES[role].toLowerCase()}, ${active ? "активен" : "отключён"}`);
    });
  },
  async resetPassword(id, password) {
    if (await apiReady) return call("admin.php?action=reset_password", { method: "POST", data: { id, password } });
    demo.need("users.manage");
    if ((password || "").length < 12) throw new Error("Новый пароль — не короче 12 символов.");
    demo.edit((s) => demo.log(s, "user_password_reset", s.users.find((x) => x.id === id).login));
  },
  async audit() {
    if (await apiReady) return (await call("admin.php?action=audit")).audit;
    demo.need("audit.view");
    return demo.load().audit;
  },
};
