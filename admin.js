// Панель администратора (демо).
const admin = document.getElementById("admin");
const ROLE_NAMES = { parent: "Родитель", medic: "Медработник", admin: "Администратор" };
const STATUS_NAMES = { active: "Активен", pending: "На проверке", blocked: "Отключён" };
let adminTab = "summary";
try { adminTab = sessionStorage.getItem("bpz-admin-tab") || adminTab; } catch (e) {}

renderAdmin();

function renderAdmin() {
  const u = currentUser();
  if (!u || u.role !== "admin") {
    admin.innerHTML = `<div class="card empty"><h3>Нужны права администратора</h3>
      <p class="muted">Войдите под учётной записью администратора. В демо — кнопка «Администратор» на странице входа.</p>
      <a class="btn btn--primary" href="login.html">Войти</a></div>`;
    return;
  }
  const pending = STATE.users.filter((x) => x.status === "pending").length;
  const tabs = [["summary", "Сводка"], ["requests", `Заявки${pending ? ` <span class="count">${pending}</span>` : ""}`], ["users", "Пользователи"], ["schools", "Школы"], ["news", "Новости"]];
  admin.innerHTML = `<div class="cab-head"><div><p class="eyebrow eyebrow--teal">Администратор</p><h2>${esc(u.name)}</h2></div>
      <button class="btn btn--outline" id="logout">Выйти</button></div>
    <div class="chips" role="tablist">${tabs.map(([k, t]) => `<button class="chip ${k === adminTab ? "is-active" : ""}" role="tab" aria-selected="${k === adminTab}" data-tab="${k}">${t}</button>`).join("")}</div>
    <div id="adminBody"></div>`;
  document.getElementById("logout").addEventListener("click", signOut);
  admin.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    adminTab = b.dataset.tab;
    try { sessionStorage.setItem("bpz-admin-tab", adminTab); } catch (e) {}
    renderAdmin();
  }));
  const body = document.getElementById("adminBody");
  ({ summary, requests, users, schools, news })[adminTab](body);
}

function summary(body) {
  const by = (r) => STATE.users.filter((x) => x.role === r).length;
  const filled = STATE.students.filter((s) => s.card);
  const lv = [0, 1, 2, 3].map((l) => filled.filter((s) => riskLevel(s.card) === l).length);
  body.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="kpi__v">${by("parent")}</span><span class="kpi__l">родителей</span></div>
      <div class="kpi"><span class="kpi__v">${by("medic")}</span><span class="kpi__l">медработников</span></div>
      <div class="kpi"><span class="kpi__v">${filled.length} / ${STATE.students.length}</span><span class="kpi__l">карт заполнено</span></div>
      <div class="kpi"><span class="kpi__v">${lv[3]}</span><span class="kpi__l">направлены к офтальмологу</span></div>
    </div>
    <div class="card"><h3>Группы риска по заполненным картам</h3>
      <div class="hbars">${[0, 1, 2, 3].map((l) => `<div class="hbar"><span>${RISK_LEVELS[l].label}</span>
        <div class="hbar__track"><div class="hbar__fill" style="width:${filled.length ? (lv[l] / filled.length) * 100 : 0}%"></div></div><b>${lv[l]}</b></div>`).join("")}</div>
    </div>`;
}

function requests(body) {
  const list = STATE.users.filter((x) => x.status === "pending");
  body.innerHTML = list.length ? `<div class="card"><h3>Заявки медработников</h3><div class="table-scroll"><table class="tbl">
      <thead><tr><th>ФИО</th><th>Школа</th><th>Должность</th><th>Email</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.school)}</td><td>${esc(x.position)}</td><td>${esc(x.email)}</td>
        <td class="tbl__act"><button class="btn btn--sm btn--primary" data-approve="${x.id}">Одобрить</button><button class="btn btn--sm btn--outline" data-reject="${x.id}">Отклонить</button></td></tr>`).join("")}
      </tbody></table></div></div>`
    : `<div class="card empty"><h3>Новых заявок нет</h3><p class="muted">Здесь появятся медработники, которые зарегистрировались и ждут доступа.</p></div>`;
  body.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.approve, "active")));
  body.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.reject, "blocked")));
}

function setStatus(id, status) { STATE.users.find((x) => x.id === id).status = status; commit(); renderAdmin(); }

function users(body) {
  body.innerHTML = `<div class="card"><h3>Пользователи</h3><div class="table-scroll"><table class="tbl">
    <thead><tr><th>ФИО</th><th>Роль</th><th>Школа</th><th>Email</th><th>Статус</th><th></th></tr></thead><tbody>
    ${STATE.users.map((x) => {
      const school = x.school || (x.childId ? (STATE.students.find((s) => s.id === x.childId) || {}).school : "") || "—";
      const act = x.role === "admin" ? "" : x.status === "blocked"
        ? `<button class="btn btn--sm btn--outline" data-on="${x.id}">Включить</button>`
        : `<button class="btn btn--sm btn--outline" data-off="${x.id}">Отключить</button>`;
      return `<tr><td>${esc(x.name)}</td><td>${ROLE_NAMES[x.role]}</td><td>${esc(school)}</td><td>${esc(x.email)}</td>
        <td><span class="status status--${x.status}">${STATUS_NAMES[x.status]}</span></td><td class="tbl__act">${act}</td></tr>`;
    }).join("")}</tbody></table></div></div>`;
  body.querySelectorAll("[data-on]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.on, "active")));
  body.querySelectorAll("[data-off]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.off, "blocked")));
}

function schools(body) {
  body.innerHTML = `<div class="card"><h3>Школы</h3><div class="table-scroll"><table class="tbl">
    <thead><tr><th>Школа</th><th>Медработники</th><th>Ученики</th><th>Карты заполнены</th><th>3 уровень</th></tr></thead><tbody>
    ${SCHOOLS.map((sc) => {
      const st = STATE.students.filter((s) => s.school === sc), f = st.filter((s) => s.card);
      const med = STATE.users.filter((x) => x.role === "medic" && x.school === sc && x.status === "active").length;
      const pct = st.length ? Math.round((f.length / st.length) * 100) : 0;
      return `<tr><td>${sc}</td><td>${med}</td><td>${st.length}</td>
        <td><div class="progress"><div class="hbar__track"><div class="hbar__fill" style="width:${pct}%"></div></div><span>${f.length} (${pct}%)</span></div></td>
        <td>${f.filter((s) => riskLevel(s.card) === 3).length}</td></tr>`;
    }).join("")}</tbody></table></div></div>`;
}

function news(body) {
  body.innerHTML = `<div class="grid2 grid2--top">
    <form class="card form" id="newsForm" novalidate>
      <h3>Добавить новость</h3>
      <div class="fields fields--one">
        <label class="field"><span>Заголовок</span><input id="nTitle" required></label>
        <label class="field"><span>Рубрика</span><select id="nCat"><option value="project">О проекте</option><option value="eyes">Зрение</option></select></label>
        <label class="field"><span>Краткий текст</span><textarea id="nText" rows="3"></textarea></label>
        <label class="field"><span>Ссылка на источник <small>необязательно</small></span><input id="nUrl" type="url" placeholder="https://"></label>
      </div>
      <p class="form__error" id="nError" hidden></p>
      <button class="btn btn--primary" type="submit">Опубликовать</button>
    </form>
    <div class="card"><h3>Добавленные новости</h3>
      ${STATE.news.length ? `<ul class="news-admin">${STATE.news.map((n, i) => `<li><div><b>${esc(n.title)}</b><span class="muted">${esc(n.tag)} · ${esc(n.date)}</span></div>
        <button class="btn btn--sm btn--outline" data-del="${i}">Удалить</button></li>`).join("")}</ul>`
      : `<p class="muted">Пока пусто. Новости отсюда появляются первыми на главной и на странице «Новости».</p>`}
    </div></div>`;
  document.getElementById("newsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("nTitle").value.trim(), url = document.getElementById("nUrl").value.trim();
    const err = document.getElementById("nError");
    if (!title) { err.textContent = "Укажите заголовок."; err.hidden = false; return; }
    if (url && !/^https?:\/\//.test(url)) { err.textContent = "Ссылка должна начинаться с https://"; err.hidden = false; return; }
    const cat = document.getElementById("nCat").value;
    STATE.news.unshift({ cat, tag: cat === "eyes" ? "Зрение" : "О проекте", src: "БПЗ", date: today(), title,
      text: document.getElementById("nText").value.trim(), url: url || "news.html" });
    commit(); renderAdmin();
  });
  body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { STATE.news.splice(Number(b.dataset.del), 1); commit(); renderAdmin(); }));
}
