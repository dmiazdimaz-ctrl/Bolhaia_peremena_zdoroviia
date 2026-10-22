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

const $ = (s) => document.querySelector(s);

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
