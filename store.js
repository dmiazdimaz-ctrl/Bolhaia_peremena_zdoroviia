// Слой данных сайта. На хостинге с PHP работает через api/, а там, где сервера нет
// (GitHub Pages, локальный файл, предпросмотр), — в демо-режиме на localStorage.
const DEMO_KEY = "bpz-demo-v4";
const DEMO_LOGIN = { login: "admin", password: "demo" };

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
// "2026-10-12 09:30:00" (UTC) → "12.10.2026"
const fmtDate = (s) => { const d = new Date(String(s).replace(" ", "T") + "Z"); return isNaN(d) ? s : d.toLocaleDateString("ru-RU"); };

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

const demo = {
  load() {
    try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return {
      session: false, news: [], nextId: 10,
      requests: [
        { id: 1, created_at: "2026-10-05 07:00:00", name: "Анна", phone: "+7 900 000-00-01", email: "", district: "Советский", school: "Школа № 12", ages: "7–8 лет, 9–10 лет", comment: "Готовы 15 родителей из 2А", status: "new" },
        { id: 2, created_at: "2026-10-07 09:00:00", name: "Игорь", phone: "+7 900 000-00-02", email: "", district: "Советский", school: "Школа № 12", ages: "11–12 лет", comment: "", status: "new" },
        { id: 3, created_at: "2026-10-08 11:00:00", name: "Марина", phone: "+7 900 000-00-03", email: "", district: "Левобережный", school: "Гимназия № 9", ages: "9–10 лет", comment: "", status: "planned" },
      ],
    };
  },
  save(s) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) {} },
  edit(fn) { const s = this.load(); const out = fn(s); this.save(s); return out; },
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

  async me() {
    if (await apiReady) { const r = await call("auth.php?action=me"); csrf = r.csrf || ""; return r.admin; }
    return demo.load().session ? { login: DEMO_LOGIN.login } : null;
  },
  async login(login, password) {
    if (await apiReady) { const r = await call("auth.php?action=login", { method: "POST", data: { login, password } }); csrf = r.csrf; return r.admin; }
    if (login !== DEMO_LOGIN.login || password !== DEMO_LOGIN.password) throw new Error("Неверный логин или пароль.");
    demo.edit((s) => { s.session = true; });
    return { login };
  },
  async logout() {
    if (await apiReady) return call("auth.php?action=logout", { method: "POST", data: {} });
    demo.edit((s) => { s.session = false; });
  },
  async changePassword(current, next) {
    if (await apiReady) return call("auth.php?action=password", { method: "POST", data: { current, new: next } });
    throw new Error("В демо-режиме пароль не меняется.");
  },

  async requests() {
    if (await apiReady) return (await call("admin.php?action=requests")).requests;
    return demo.load().requests;
  },
  async setStatus(id, status) {
    if (await apiReady) return call("admin.php?action=status", { method: "POST", data: { id, status } });
    demo.edit((s) => { s.requests.find((r) => r.id === id).status = status; });
  },
  async deleteRequest(id) {
    if (await apiReady) return call("admin.php?action=delete_request", { method: "POST", data: { id } });
    demo.edit((s) => { s.requests = s.requests.filter((r) => r.id !== id); });
  },
  async addNews(n) {
    if (await apiReady) return call("admin.php?action=add_news", { method: "POST", data: n });
    if (!n.title) throw new Error("Укажите заголовок.");
    if (n.url && !/^https?:\/\//i.test(n.url)) throw new Error("Ссылка должна начинаться с https://");
    demo.edit((s) => s.news.unshift({ id: s.nextId++, created_at: nowIso(), ...n }));
  },
  async deleteNews(id) {
    if (await apiReady) return call("admin.php?action=delete_news", { method: "POST", data: { id } });
    demo.edit((s) => { s.news = s.news.filter((x) => x.id !== id); });
  },
};
