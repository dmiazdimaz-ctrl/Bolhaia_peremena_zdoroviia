// Демо-авторизация прототипа. Сервера нет: пользователи, сводные отчёты по классам,
// заявки и новости хранятся в localStorage этого браузера. Пароли не сохраняются.
// Персональных данных детей нет: только количества по классам.
const STORE_KEY = "bpz-demo-v3";

const SCHOOLS = ["Школа № 1", "Гимназия № 2", "Лицей № 3", "Школа № 4", "Школа № 5"];

// Возраст → месяцы скрининга (график 2026/2027).
const SCHEDULE = { 8: "октябрь–ноябрь", 9: "ноябрь–декабрь", 11: "декабрь–январь", 12: "февраль–март", 13: "март–апрель" };

const RISK_LEVELS = {
  0: { label: "Нет факторов риска", cls: "risk--0" },
  1: { label: "1 уровень риска", cls: "risk--1" },
  2: { label: "2 уровень риска", cls: "risk--2" },
  3: { label: "3 уровень — к офтальмологу", cls: "risk--3" },
};

// Уровень риска по «Карте предикторов миопии»: факторы, отмеченные медработником,
// дают 3 уровень; иначе один фактор образа жизни — 1, два и больше — 2.
function riskLevel(card) {
  if (card.eyeMovement || card.malinovsky) return 3;
  const n = [card.outdoor, card.gadgets, card.parents].filter(Boolean).length;
  return n >= 2 ? 2 : n;
}

// Сумма уровней риска по набору отчётов: [нет, 1, 2, 3].
const sumLevels = (reports) => reports.reduce((a, x) => a.map((v, i) => v + x.levels[i]), [0, 0, 0, 0]);

function seed() {
  const r = (id, cls, age, enrolled, screened, l0, l1, l2, l3, date) => ({ id, school: "Школа № 1", cls, age, enrolled, screened, levels: [l0, l1, l2, l3], date });
  return {
    session: null,
    users: [
      { id: "u-admin", role: "admin", name: "Координатор проекта", email: "admin@demo", status: "active" },
      { id: "u-med", role: "medic", name: "Петрова Ольга Ивановна", email: "medic@demo", school: "Школа № 1", position: "Медсестра", status: "active" },
      { id: "u-med2", role: "medic", name: "Смирнова Елена Павловна", email: "smirnova@demo", school: "Лицей № 3", position: "Фельдшер", status: "pending" },
    ],
    reports: [
      r("c-1", "2А", 8, 27, 25, 15, 6, 3, 1, "14.10.2026"),
      r("c-2", "2Б", 8, 26, 24, 13, 7, 2, 2, "15.10.2026"),
      r("c-3", "3А", 9, 28, 12, 8, 3, 1, 0, "05.11.2026"),
    ],
    news: [],
    requests: [
      { id: "r-1", date: "05.10.2026", name: "Анна", phone: "+7 900 000-00-01", email: "", district: "Советский", school: "Школа № 12", ages: ["7–8 лет", "9–10 лет"], comment: "Готовы 15 родителей из 2А", status: "new" },
      { id: "r-2", date: "07.10.2026", name: "Игорь", phone: "+7 900 000-00-02", email: "", district: "Советский", school: "Школа № 12", ages: ["11–12 лет"], comment: "", status: "new" },
      { id: "r-3", date: "08.10.2026", name: "Марина", phone: "+7 900 000-00-03", email: "", district: "Левобережный", school: "Гимназия № 9", ages: ["9–10 лет"], comment: "", status: "planned" },
    ],
  };
}

const Store = {
  load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return seed();
  },
  save(state) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} },
  reset() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} },
};

let STATE = Store.load();
const commit = () => Store.save(STATE);
const currentUser = () => STATE.users.find((u) => u.id === STATE.session) || null;
const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 8);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("ru-RU");

function signIn(userId) { STATE.session = userId; commit(); location.href = "cabinet.html"; }
function signOut() { STATE.session = null; commit(); location.href = "index.html"; }

// Кнопка входа в шапке: «Войти» или «Кабинет».
document.querySelectorAll("[data-auth]").forEach((a) => {
  const u = currentUser();
  if (u) { a.textContent = u.role === "admin" ? "Админ-панель" : "Кабинет"; a.href = u.role === "admin" ? "admin.html" : "cabinet.html"; }
});
