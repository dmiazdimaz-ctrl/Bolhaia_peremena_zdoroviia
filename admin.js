// Вход координатора и панель администратора: заявки родителей и новости.
const REQ_STATUS = { new: "Новая", work: "В работе", planned: "Выезд запланирован", done: "Проведено", rejected: "Отклонена" };
const CATS = { project: "О проекте", eyes: "Зрение" };

// ---------- Вход ----------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  Store.isDemo().then((d) => { document.getElementById("loginDemo").hidden = !d; });
  Store.me().then((a) => { if (a) location.href = "admin.html"; }).catch(() => {});
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("loginError");
    err.hidden = true;
    try {
      await Store.login(document.getElementById("loginName").value.trim(), document.getElementById("loginPass").value);
      location.href = "admin.html";
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

// ---------- Панель ----------
const admin = document.getElementById("admin");
let adminTab = "requests";
try { adminTab = sessionStorage.getItem("bpz-admin-tab") || adminTab; } catch (e) {}
if (admin) boot();

async function boot() {
  let me = null;
  try { me = await Store.me(); } catch (ex) { return showError(ex.message); }
  if (!me) {
    admin.innerHTML = `<div class="card empty"><h3>Нужно войти</h3><p class="muted">Панель доступна только координаторам проекта.</p>
      <a class="btn btn--primary" href="login.html">Войти</a></div>`;
    return;
  }
  render(me);
}

function showError(text) {
  admin.innerHTML = `<div class="card card--alert"><h3>Не удалось загрузить данные</h3><p>${esc(text)}</p></div>`;
}

async function render(me) {
  let requests, news;
  try { [requests, news] = await Promise.all([Store.requests(), Store.listNews()]); } catch (ex) { return showError(ex.message); }
  const fresh = requests.filter((r) => r.status === "new").length;
  const tabs = [["requests", "Заявки родителей" + (fresh ? ` <span class="count">${fresh}</span>` : "")], ["summary", "Сводка"], ["news", "Новости"], ["account", "Учётная запись"]];
  admin.innerHTML = `<div class="cab-head"><div><p class="eyebrow eyebrow--teal">Координатор</p><h2>${esc(me.login)}</h2></div>
      <button class="btn btn--outline" id="logout">Выйти</button></div>
    <div class="chips" role="tablist">${tabs.map(([k, t]) => `<button class="chip ${k === adminTab ? "is-active" : ""}" role="tab" aria-selected="${k === adminTab}" data-tab="${k}">${t}</button>`).join("")}</div>
    <div id="adminBody"></div>`;
  document.getElementById("logout").addEventListener("click", async () => { await Store.logout().catch(() => {}); location.href = "index.html"; });
  admin.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    adminTab = b.dataset.tab;
    try { sessionStorage.setItem("bpz-admin-tab", adminTab); } catch (e) {}
    render(me);
  }));
  const body = document.getElementById("adminBody");
  const views = { requests: viewRequests, summary: viewSummary, news: viewNews, account: viewAccount };
  (views[adminTab] || viewRequests)(body, { requests, news, me, refresh: () => render(me) });
}

// Группировка заявок по школе: куда ехать в первую очередь.
function bySchool(requests) {
  const m = {};
  requests.forEach((r) => {
    const k = (r.school.trim() + "|" + r.district).toLowerCase();
    const g = (m[k] = m[k] || { school: r.school, district: r.district, n: 0, open: 0 });
    g.n++; if (r.status === "new" || r.status === "work") g.open++;
  });
  return Object.values(m).sort((a, b) => b.n - a.n);
}

function viewRequests(body, { requests, refresh }) {
  if (!requests.length) {
    body.innerHTML = `<div class="card empty"><h3>Заявок пока нет</h3><p class="muted">Здесь появятся заявки родителей со страницы «Пригласить БПЗ».</p></div>`;
    return;
  }
  body.innerHTML = `<div class="card"><h3>Все заявки</h3><div class="table-scroll"><table class="tbl">
    <thead><tr><th>Дата</th><th>Школа</th><th>Возраст детей</th><th>Контакт</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead><tbody>
    ${requests.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.school)}<br><span class="muted">${esc(r.district)}</span></td>
      <td>${esc(r.ages || "—")}</td>
      <td>${esc(r.name)}<br><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${esc(r.phone)}</a>${r.email ? `<br><span class="muted">${esc(r.email)}</span>` : ""}</td>
      <td>${esc(r.comment || "—")}</td>
      <td><select class="req-status" data-req="${r.id}" aria-label="Статус заявки">${Object.entries(REQ_STATUS).map(([k, t]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${t}</option>`).join("")}</select></td>
      <td class="tbl__act"><button class="btn btn--sm btn--outline" data-del="${r.id}" aria-label="Удалить заявку">✕</button></td></tr>`).join("")}
    </tbody></table></div></div>`;
  body.querySelectorAll("[data-req]").forEach((sel) => sel.addEventListener("change", async () => {
    try { await Store.setStatus(Number(sel.dataset.req), sel.value); refresh(); } catch (ex) { alertRow(sel, ex.message); }
  }));
  body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Удалить?"; return; }
    try { await Store.deleteRequest(Number(b.dataset.del)); refresh(); } catch (ex) { alertRow(b, ex.message); }
  }));
}

function alertRow(el, text) {
  const td = el.closest("td");
  td.insertAdjacentHTML("beforeend", `<p class="form__error">${esc(text)}</p>`);
}

function viewSummary(body, { requests }) {
  const count = (s) => requests.filter((r) => r.status === s).length;
  const schools = bySchool(requests);
  body.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="kpi__v">${requests.length}</span><span class="kpi__l">всего заявок</span></div>
      <div class="kpi"><span class="kpi__v">${count("new")}</span><span class="kpi__l">новых</span></div>
      <div class="kpi"><span class="kpi__v">${schools.length}</span><span class="kpi__l">школ в заявках</span></div>
      <div class="kpi"><span class="kpi__v">${count("planned") + count("done")}</span><span class="kpi__l">выездов запланировано и проведено</span></div>
    </div>
    <div class="card"><h3>Школы по числу заявок</h3>${schools.length ? `<div class="table-scroll"><table class="tbl">
      <thead><tr><th>Школа</th><th>Район</th><th>Заявок</th><th>Ждут ответа</th></tr></thead><tbody>
      ${schools.map((t) => `<tr><td>${esc(t.school)}</td><td>${esc(t.district)}</td><td><b>${t.n}</b></td><td>${t.open}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muted">Заявок пока нет.</p>`}</div>`;
}

function viewNews(body, { news, refresh }) {
  body.innerHTML = `<div class="grid2 grid2--top">
    <form class="card form" id="newsForm" novalidate>
      <h3>Добавить новость</h3>
      <div class="fields fields--one">
        <label class="field"><span>Заголовок</span><input id="nTitle" maxlength="200" required></label>
        <label class="field"><span>Рубрика</span><select id="nCat">${Object.entries(CATS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
        <label class="field"><span>Краткий текст</span><textarea id="nText" rows="3" maxlength="1000"></textarea></label>
        <label class="field"><span>Ссылка на источник <small>необязательно</small></span><input id="nUrl" type="url" placeholder="https://"></label>
      </div>
      <p class="form__error" id="nError" hidden></p>
      <button class="btn btn--primary" type="submit">Опубликовать</button>
    </form>
    <div class="card"><h3>Добавленные новости</h3>
      ${news.length ? `<ul class="news-admin">${news.map((n) => `<li><div><b>${esc(n.title)}</b><span class="muted">${CATS[n.cat] || ""} · ${fmtDate(n.created_at)}</span></div>
        <button class="btn btn--sm btn--outline" data-delnews="${n.id}">Удалить</button></li>`).join("")}</ul>`
      : `<p class="muted">Пока пусто. Новости отсюда появляются первыми на главной и на странице «Новости».</p>`}
    </div></div>`;
  document.getElementById("newsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("nError");
    try {
      await Store.addNews({ title: document.getElementById("nTitle").value.trim(), cat: document.getElementById("nCat").value,
        text: document.getElementById("nText").value.trim(), url: document.getElementById("nUrl").value.trim() });
      refresh();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  body.querySelectorAll("[data-delnews]").forEach((b) => b.addEventListener("click", async () => {
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Точно удалить?"; return; }
    try { await Store.deleteNews(Number(b.dataset.delnews)); refresh(); } catch (ex) { alertRow(b, ex.message); }
  }));
}

function viewAccount(body) {
  body.innerHTML = `<form class="card form narrow" id="pwForm" novalidate>
      <h3>Сменить пароль</h3>
      <div class="fields fields--one">
        <label class="field"><span>Текущий пароль</span><input id="pwCur" type="password" autocomplete="current-password"></label>
        <label class="field"><span>Новый пароль <small>не короче 12 символов</small></span><input id="pwNew" type="password" minlength="12" autocomplete="new-password"></label>
      </div>
      <p class="form__error" id="pwError" hidden></p>
      <p class="form__ok" id="pwOk" hidden>Пароль изменён.</p>
      <button class="btn btn--primary" type="submit">Сохранить</button>
    </form>`;
  document.getElementById("pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("pwError"), ok = document.getElementById("pwOk");
    err.hidden = ok.hidden = true;
    const next = document.getElementById("pwNew").value;
    if (next.length < 12) { err.textContent = "Новый пароль должен быть не короче 12 символов."; err.hidden = false; return; }
    try { await Store.changePassword(document.getElementById("pwCur").value, next); ok.hidden = false; e.target.reset(); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}
