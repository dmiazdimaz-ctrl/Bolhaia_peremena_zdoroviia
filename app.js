// Демо-данные прототипа. В рабочей версии — загрузка из CMS / API.
const NEWS = [
  { cat: "screen", tag: "Скрининг", date: "07.10.2026", icon: "👁️", title: "Стартовал скрининг 2026/2027: первыми обследуют восьмилеток",
    text: "Школьные медкабинеты начали заполнять «Карты предикторов миопии» для учеников 8 лет." },
  { cat: "event", tag: "События", date: "25.09.2026", icon: "🤝", title: "Медработники школ прошли обучение по новой методике",
    text: "Специалисты областной офтальмологической больницы провели семинар по заполнению карты предикторов." },
  { cat: "parents", tag: "Родителям", date: "18.09.2026", icon: "🏡", title: "Упражнение «Метка на стекле»: как заниматься дома",
    text: "Курс 15–20 дней, 2 раза в день. Рассказываем, как правильно тренировать аккомодацию." },
  { cat: "parents", tag: "Родителям", date: "10.09.2026", icon: "🤸", title: "Гимнастика для глаз за 5–7 минут в день",
    text: "Комплекс из 8 упражнений по методу профессора Аветисова Э.С. — с картинками и таймингом." },
  { cat: "event", tag: "События", date: "01.09.2026", icon: "🎒", title: "«Большая перемена здоровья» — в школах Воронежа",
    text: "Программа профилактики школьной миопии стартует в новом учебном году." },
  { cat: "screen", tag: "Скрининг", date: "20.08.2026", icon: "📋", title: "Утверждён график скрининга на учебный год",
    text: "Обследования пройдут с октября по апрель для детей 8, 9, 11, 12 и 13 лет; в мае — отчёт." },
];

const AGES = [
  { age: "8 лет", plan: 900, fact: 880 },
  { age: "9 лет", plan: 850, fact: 790 },
  { age: "11 лет", plan: 820, fact: 610 },
  { age: "12 лет", plan: 800, fact: 480 },
  { age: "13 лет", plan: 780, fact: 360 },
];

const RISK = [
  { label: "Нет факторов риска", value: 2278, color: "#c9d6e6" },
  { label: "1 уровень риска", value: 446, color: "#4fb89b" },
  { label: "2 уровень риска", value: 182, color: "#2f7aa0" },
  { label: "3 уровень — к офтальмологу", value: 214, color: "#2457a0" },
];

const FACTORS = [
  { label: "Много времени с гаджетами (> 1,5 ч/день)", pct: 41 },
  { label: "Мало времени на улице (< 90 мин/день)", pct: 34 },
  { label: "Близорукость у одного или обоих родителей", pct: 22 },
  { label: "Положительный тест Малиновского", pct: 9 },
  { label: "Нарушения движений глаз / бинокулярного зрения", pct: 5 },
];

const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("ru-RU");

// Меню на мобильных
const burger = $(".burger"), nav = $(".nav");
burger.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", open);
});
nav.addEventListener("click", (e) => { if (e.target.tagName === "A") nav.classList.remove("is-open"); });

// Новости
function renderNews(filter) {
  $("#newsList").innerHTML = NEWS.filter((n) => filter === "all" || n.cat === filter).map((n) => `
    <article class="post">
      <div class="post__img">${n.icon}</div>
      <div class="post__body">
        <div class="post__meta"><span class="tag">${n.tag}</span><time>${n.date}</time></div>
        <h4>${n.title}</h4>
        <p>${n.text}</p>
        <a href="#news">Читать далее →</a>
      </div>
    </article>`).join("");
}
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-active"));
  c.classList.add("is-active");
  renderNews(c.dataset.f);
}));
renderNews("all");

// Охват по возрастам
const max = Math.max(...AGES.map((a) => a.plan));
$("#ageBars").innerHTML = AGES.map((a) => `
  <div class="bar" title="${a.age}: ${fmt(a.fact)} из ${fmt(a.plan)}">
    <div class="bar__plan" style="height:${(a.plan / max) * 100}%"></div>
    <span class="bar__v">${fmt(a.fact)}</span>
    <div class="bar__fact" style="height:${(a.fact / max) * 88}%"></div>
  </div>`).join("");
$("#ageBars").insertAdjacentHTML("afterend",
  `<div class="bar__x">${AGES.map((a) => `<span>${a.age}</span>`).join("")}</div>`);

// Группы риска (кольцевая диаграмма)
const total = RISK.reduce((s, r) => s + r.value, 0);
const R = 15.915; // длина окружности = 100
let offset = 0;
$("#donut").innerHTML = RISK.map((r) => {
  const pct = (r.value / total) * 100;
  const seg = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${r.color}" stroke-width="6"
    stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-offset}"><title>${r.label}: ${fmt(r.value)}</title></circle>`;
  offset += pct;
  return seg;
}).join("");
$("#legend").innerHTML = RISK.map((r) =>
  `<li><i style="background:${r.color}"></i><b>${Math.round((r.value / total) * 100)}%</b>${r.label} <span class="muted">(${fmt(r.value)})</span></li>`).join("");

// Факторы риска
$("#factorBars").innerHTML = FACTORS.map((f) => `
  <div class="hbar"><span>${f.label}</span>
    <div class="hbar__track"><div class="hbar__fill" style="width:${f.pct}%"></div></div>
    <b>${f.pct}%</b></div>`).join("");
