// Публикации о проекте (заголовки из открытых источников).
const NEWS = [
  { cat: "eyes", tag: "Зрение", src: "Вести Воронеж", date: "15.06.2026",
    title: "Пандемия близорукости. Что может спасти зрение воронежских школьников",
    text: "В рамках проекта обследуют здоровых детей, чтобы выявить факторы риска миопии до появления болезни.",
    url: "https://vestivrn.ru/news/2026/06/15/pandemiya-blizorukosti-chto-mozhet-spasti-zrenie-voronezhskikh-shkolnikov/" },
  { cat: "project", tag: "О проекте", src: "Губерния", date: "",
    title: "Проект «Большая перемена здоровья» реализуют в Воронежской области",
    text: "Четыре направления: зрение, репродуктивное здоровье, профилактика сколиоза и борьба с лишним весом.",
    url: "https://tv-gubernia.ru/novosti/obwestvo/proekt-bolshaya-peremena-zdorovya-realizuyut-v-voronezhskoj-oblasti/" },
  { cat: "eyes", tag: "Зрение", src: "Портал Воронеж", date: "",
    title: "Почти у каждого второго воронежского школьника обнаружили проблемы со зрением",
    text: "Результаты обследований в рамках межведомственного проекта «Большая перемена здоровья».",
    url: "https://portalvoronezh.ru/news/obschestvo/pochti-u-kazhdogo-vtorogo-voronezhskogo-shkolnika-obnaruzhili-problemy-so-zreniem.html" },
  { cat: "eyes", tag: "Зрение", src: "Горком36", date: "",
    title: "Ведущий воронежский офтальмолог рассказала, почему все больше школьников выявляются с риском развития миопии",
    text: "О предикторах миопии: зрение у ребёнка ещё стопроцентное, но предрасположенность уже есть.",
    url: "https://gorcom36.ru/content/vedushchiy-voronezhskiy-oftalmolog-rasskazala-pochemu-vse-bolshe-shkolnikov-vyyavlyayutsya-s-riskom-/" },
  { cat: "project", tag: "О проекте", src: "okob.vrn.ru", date: "",
    title: "Большая перемена здоровья — страница проекта для родителей",
    text: "Рекомендации и контакты офтальмологической службы Воронежской области.",
    url: "https://www.okob.vrn.ru/big-health-change" },
];

// Демо-данные аналитики. В рабочей версии — данные координаторов проекта.
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

// Новости: сначала добавленные координатором (из store.js), затем публикации СМИ.
const newsList = $("#newsList");
const CAT_TAG = { project: "О проекте", eyes: "Зрение" };
let NEWS_ALL = NEWS;
function renderNews(filter) {
  const limit = Number(newsList.dataset.limit) || NEWS_ALL.length;
  newsList.innerHTML = NEWS_ALL.filter((n) => filter === "all" || n.cat === filter).slice(0, limit).map((n) => `
    <article class="post">
      <div class="post__img">${n.src}</div>
      <div class="post__body">
        <div class="post__meta"><span class="tag">${n.tag}</span>${n.date ? `<time>${n.date}</time>` : ""}</div>
        <h4>${n.title}</h4>
        <p>${n.text}</p>
        ${/^https?:/.test(n.url) ? `<a href="${n.url}" target="_blank" rel="noopener">Читать в источнике →</a>` : ""}
      </div>
    </article>`).join("");
}
document.querySelectorAll("[data-f]").forEach((c) => c.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-active"));
  c.classList.add("is-active");
  renderNews(c.dataset.f);
}));
if (newsList) {
  renderNews("all");
  if (typeof Store !== "undefined") Store.listNews().then((own) => {
    if (!own.length) return;
    NEWS_ALL = [...own.map((n) => ({ cat: n.cat, tag: CAT_TAG[n.cat] || "О проекте", src: "БПЗ", date: fmtDate(n.created_at),
      title: esc(n.title), text: esc(n.text), url: esc(n.url) })), ...NEWS];
    const active = document.querySelector("[data-f].is-active");
    renderNews(active ? active.dataset.f : "all");
  });
}

if ($("#ageBars")) {
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
}
