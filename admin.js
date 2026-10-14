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

const ACTIONS = {
  setup: "Настройка сайта", login: "Вход", login_failed: "Неудачный вход", logout: "Выход", password_change: "Смена своего пароля",
  request_status: "Статус заявки", request_delete: "Удаление заявки", requests_export: "Выгрузка в Excel", news_add: "Новость добавлена", news_delete: "Новость удалена",
  user_create: "Пользователь создан", user_update: "Пользователь изменён", user_password_reset: "Сброс пароля",
};

async function render(me) {
  const tabs = [
    can(me, "requests.view") && ["requests", "Заявки родителей"],
    ["summary", "Сводка"],
    can(me, "news.manage") && ["news", "Новости"],
    can(me, "users.manage") && ["users", "Пользователи"],
    can(me, "audit.view") && ["audit", "Журнал"],
    ["account", "Учётная запись"],
  ].filter(Boolean);
  if (!tabs.some(([k]) => k === adminTab)) adminTab = tabs[0][0];

  let data = {};
  try {
    const load = {
      requests: async () => ({ requests: await Store.requests() }),
      summary: async () => ({ summary: await Store.summary() }),
      news: async () => ({ news: await Store.listNews() }),
      users: async () => ({ users: await Store.users() }),
      audit: async () => ({ audit: await Store.audit() }),
      account: async () => ({}),
    };
    data = await load[adminTab]();
  } catch (ex) { return showError(ex.message); }

  admin.innerHTML = `<div class="cab-head"><div><p class="eyebrow eyebrow--teal">${ROLE_NAMES[me.role] || me.role}</p><h2>${esc(me.name || me.login)}</h2>
      <p class="muted">${esc(me.login)}</p></div>
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
  const views = { requests: viewRequests, summary: viewSummary, news: viewNews, users: viewUsers, audit: viewAudit, account: viewAccount };
  views[adminTab](body, { ...data, me, refresh: () => render(me) });
}

function viewRequests(body, { requests, me, refresh }) {
  if (!requests.length) {
    body.innerHTML = `<div class="card empty"><h3>Заявок пока нет</h3><p class="muted">Здесь появятся заявки родителей со страницы «Пригласить БПЗ».</p></div>`;
    return;
  }
  const edit = can(me, "requests.edit"), del = can(me, "requests.delete");
  body.innerHTML = `<div class="card"><div class="card__head"><h3>Все заявки <span class="muted">(${requests.length})</span></h3>
    ${can(me, "requests.export") ? `<button class="btn btn--sm btn--outline" id="exportXlsx">⬇ Выгрузить в Excel</button>` : ""}</div>
    <p class="form__error" id="exportError" hidden></p><div class="table-scroll"><table class="tbl">
    <thead><tr><th>Дата</th><th>Школа</th><th>Возраст детей</th><th>Контакт</th><th>Комментарий</th><th>Статус</th>${del ? "<th></th>" : ""}</tr></thead><tbody>
    ${requests.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.school)}<br><span class="muted">${esc(r.district)}</span></td>
      <td>${esc(r.ages || "—")}</td>
      <td>${esc(r.name)}<br><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${esc(r.phone)}</a>${r.email ? `<br><span class="muted">${esc(r.email)}</span>` : ""}</td>
      <td>${esc(r.comment || "—")}</td>
      <td>${edit ? `<select class="req-status" data-req="${r.id}" aria-label="Статус заявки">${Object.entries(REQ_STATUS).map(([k, t]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${t}</option>`).join("")}</select>`
        : `<span class="status status--${r.status === "new" ? "pending" : "active"}">${REQ_STATUS[r.status]}</span>`}</td>
      ${del ? `<td class="tbl__act"><button class="btn btn--sm btn--outline" data-del="${r.id}" aria-label="Удалить заявку">✕</button></td>` : ""}</tr>`).join("")}
    </tbody></table></div></div>`;
  const exp = document.getElementById("exportXlsx");
  if (exp) exp.addEventListener("click", async () => {
    const err = document.getElementById("exportError");
    err.hidden = true; exp.disabled = true; exp.textContent = "Готовим файл…";
    try {
      const blob = await Store.exportRequests();
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `zayavki-bpz-${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { exp.disabled = false; exp.textContent = "⬇ Выгрузить в Excel"; }
  });
  body.querySelectorAll("[data-req]").forEach((sel) => sel.addEventListener("change", async () => {
    try { await Store.setStatus(Number(sel.dataset.req), sel.value); refresh(); } catch (ex) { alertRow(sel, ex.message); }
  }));
  body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Удалить?"; return; }
    try { await Store.deleteRequest(Number(b.dataset.del)); refresh(); } catch (ex) { alertRow(b, ex.message); }
  }));
}

function alertRow(el, text) {
  const td = el.closest("td") || el.parentElement;
  td.insertAdjacentHTML("beforeend", `<p class="form__error">${esc(text)}</p>`);
}

function viewSummary(body, { summary, me }) {
  const st = summary.byStatus;
  body.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="kpi__v">${summary.total}</span><span class="kpi__l">всего заявок</span></div>
      <div class="kpi"><span class="kpi__v">${st.new}</span><span class="kpi__l">новых</span></div>
      <div class="kpi"><span class="kpi__v">${summary.schools.length}</span><span class="kpi__l">школ в заявках</span></div>
      <div class="kpi"><span class="kpi__v">${st.planned + st.done}</span><span class="kpi__l">выездов запланировано и проведено</span></div>
    </div>
    <div class="card"><h3>Школы по числу заявок</h3>${summary.schools.length ? `<div class="table-scroll"><table class="tbl">
      <thead><tr><th>Школа</th><th>Район</th><th>Заявок</th><th>Ждут ответа</th></tr></thead><tbody>
      ${summary.schools.map((t) => `<tr><td>${esc(t.school)}</td><td>${esc(t.district)}</td><td><b>${t.n}</b></td><td>${t.open}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muted">Заявок пока нет.</p>`}
      ${can(me, "requests.view") ? "" : `<p class="muted">Контакты родителей видны только координаторам.</p>`}</div>`;
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

function viewUsers(body, { users, me, refresh }) {
  const roleOpts = (sel) => Object.entries(ROLE_NAMES).map(([k, t]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t}</option>`).join("");
  body.innerHTML = `<div class="card"><h3>Пользователи панели</h3><div class="table-scroll"><table class="tbl">
      <thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>
      ${users.map((u) => {
        const self = u.id === me.id;
        return `<tr><td>${esc(u.name || "—")}${self ? ' <span class="muted">(вы)</span>' : ""}</td><td>${esc(u.login)}</td>
          <td><select class="req-status" data-role="${u.id}" aria-label="Роль ${esc(u.login)}" ${self ? "disabled" : ""}>${roleOpts(u.role)}</select></td>
          <td><span class="status status--${u.active ? "active" : "blocked"}">${u.active ? "Активен" : "Отключён"}</span></td>
          <td class="tbl__act">${self ? "" : `<button class="btn btn--sm btn--outline" data-toggle="${u.id}" data-active="${u.active ? 1 : 0}">${u.active ? "Отключить" : "Включить"}</button>`}
            <button class="btn btn--sm btn--outline" data-reset="${u.id}" data-login="${esc(u.login)}">Сбросить пароль</button></td></tr>`;
      }).join("")}</tbody></table></div>
      <div id="resetBox" hidden></div></div>
    <div class="grid2 grid2--top">
      <form class="card form" id="userForm" novalidate>
        <h3>Добавить пользователя</h3>
        <div class="fields fields--one">
          <label class="field"><span>Имя</span><input id="uName" maxlength="100" placeholder="Например, Иванова Анна — Минздрав ВО"></label>
          <label class="field"><span>Логин <small>латиница, цифры, точка, дефис</small></span><input id="uLogin" maxlength="60" autocomplete="off"></label>
          <label class="field"><span>Роль</span><select id="uRole">${roleOpts("coordinator")}</select></label>
          <label class="field"><span>Временный пароль <small>не короче 12 символов</small></span>
            <div class="pw-row"><input id="uPass" autocomplete="new-password"><button type="button" class="btn btn--sm btn--outline" id="uGen">Сгенерировать</button></div></label>
        </div>
        <p class="form__error" id="uError" hidden></p>
        <button class="btn btn--primary" type="submit">Создать</button>
        <p class="muted">Передайте логин и пароль сотруднику лично и попросите сменить пароль во вкладке «Учётная запись».</p>
      </form>
      <div class="card"><h3>Что может каждая роль</h3>
        <ul class="roles-list">
          <li><b>Главный администратор</b> — всё, включая пользователей, удаление заявок и журнал.</li>
          <li><b>Координатор</b> — заявки с контактами, смена статусов, сводка, новости.</li>
          <li><b>Редактор новостей</b> — новости и сводка, без контактов родителей.</li>
          <li><b>Наблюдатель</b> — только сводка в цифрах, без контактов. Например, для министерства.</li>
        </ul>
      </div>
    </div>`;

  const genPass = () => { const a = new Uint32Array(4); crypto.getRandomValues(a); return Array.from(a, (n) => n.toString(36).padStart(7, "0")).join("-").slice(0, 20); };
  document.getElementById("uGen").addEventListener("click", () => { document.getElementById("uPass").value = genPass(); });

  document.getElementById("userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("uError");
    try {
      await Store.createUser({ name: document.getElementById("uName").value.trim(), login: document.getElementById("uLogin").value.trim(),
        role: document.getElementById("uRole").value, password: document.getElementById("uPass").value });
      refresh();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  body.querySelectorAll("[data-role]").forEach((sel) => sel.addEventListener("change", async () => {
    try { await Store.updateUser(Number(sel.dataset.role), { role: sel.value }); refresh(); } catch (ex) { alertRow(sel, ex.message); }
  }));
  body.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
    try { await Store.updateUser(Number(b.dataset.toggle), { active: b.dataset.active !== "1" }); refresh(); } catch (ex) { alertRow(b, ex.message); }
  }));
  body.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => {
    const box = document.getElementById("resetBox"), pass = genPass();
    box.hidden = false;
    box.innerHTML = `<form class="reset-box" id="resetForm"><p>Новый пароль для <b>${esc(b.dataset.login)}</b>:</p>
      <div class="pw-row"><input id="rPass" value="${pass}" aria-label="Новый пароль"><button class="btn btn--sm btn--primary" type="submit">Сохранить</button>
      <button class="btn btn--sm btn--outline" type="button" id="rCancel">Отмена</button></div><p class="form__error" id="rError" hidden></p></form>`;
    document.getElementById("rCancel").onclick = () => { box.hidden = true; };
    document.getElementById("resetForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await Store.resetPassword(Number(b.dataset.reset), document.getElementById("rPass").value);
        box.innerHTML = `<p class="form__ok">Пароль для ${esc(b.dataset.login)} изменён. Передайте его сотруднику лично.</p>`;
      } catch (ex) { const r = document.getElementById("rError"); r.textContent = ex.message; r.hidden = false; }
    };
  }));
}

function viewAudit(body, { audit }) {
  body.innerHTML = `<div class="card"><h3>Журнал действий</h3><p class="muted">Последние 300 событий: кто и что делал в панели.</p>
    ${audit.length ? `<div class="table-scroll"><table class="tbl">
      <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Подробности</th></tr></thead><tbody>
      ${audit.map((a) => `<tr><td>${fmtDateTime(a.created_at)}</td><td>${esc(a.admin_login)}</td>
        <td class="${a.action === "login_failed" ? "is-warn" : ""}">${ACTIONS[a.action] || esc(a.action)}</td><td>${esc(a.details || "—")}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">Событий пока нет.</p>`}</div>`;
}
