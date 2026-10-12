// Демо-авторизация прототипа. Сервера нет: пользователи, ученики и новости
// хранятся в localStorage этого браузера. Пароли не сохраняются.
const STORE_KEY = "bpz-demo-v1";

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

function seed() {
  const s = (id, name, age, cls, card) => ({ id, name, age, cls, school: "Школа № 1", card });
  return {
    session: null,
    users: [
      { id: "u-admin", role: "admin", name: "Координатор проекта", email: "admin@demo", status: "active" },
      { id: "u-med", role: "medic", name: "Петрова Ольга Ивановна", email: "medic@demo", school: "Школа № 1", position: "Медсестра", status: "active" },
      { id: "u-par", role: "parent", name: "Иванова Анна Сергеевна", email: "parent@demo", childId: "s-1", status: "active" },
      { id: "u-med2", role: "medic", name: "Смирнова Елена Павловна", email: "smirnova@demo", school: "Лицей № 3", position: "Фельдшер", status: "pending" },
    ],
    students: [
      s("s-1", "Иванов Миша", 8, "2А", { outdoor: true, gadgets: true, parents: false, eyeMovement: false, malinovsky: false, date: "14.10.2026" }),
      s("s-2", "Кузнецова Даша", 8, "2А", { outdoor: false, gadgets: false, parents: false, eyeMovement: false, malinovsky: false, date: "14.10.2026" }),
      s("s-3", "Орлов Артём", 8, "2А", { outdoor: false, gadgets: true, parents: false, eyeMovement: false, malinovsky: false, date: "15.10.2026" }),
      s("s-4", "Соколова Вера", 8, "2Б", { outdoor: true, gadgets: true, parents: true, eyeMovement: false, malinovsky: true, date: "15.10.2026" }),
      s("s-5", "Морозов Илья", 8, "2Б", null),
      s("s-6", "Волкова Лиза", 9, "3А", null),
      s("s-7", "Зайцев Кирилл", 9, "3А", null),
    ],
    news: [],
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
