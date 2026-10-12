// Регистрация, вход и личный кабинет (демо).
document.querySelectorAll("[data-schools]").forEach((sel) => {
  sel.innerHTML = SCHOOLS.map((s) => `<option>${s}</option>`).join("");
});

function showError(el, text) { el.textContent = text; el.hidden = !text; }

// ---------- Регистрация ----------
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  const syncRole = () => {
    const role = registerForm.role.value;
    registerForm.querySelectorAll("[data-role]").forEach((el) => { el.hidden = el.dataset.role !== role; });
  };
  registerForm.addEventListener("change", (e) => { if (e.target.name === "role") syncRole(); });
  syncRole();

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = registerForm, err = document.getElementById("regError");
    const role = f.role.value, email = f.email.value.trim().toLowerCase();
    if (!f.name.value.trim()) return showError(err, "Укажите ФИО.");
    if (!f.email.checkValidity() || !email) return showError(err, "Проверьте email: в нём должна быть «@».");
    if (STATE.users.some((u) => u.email === email)) return showError(err, "Этот email уже зарегистрирован. Войдите или укажите другой.");
    if (f.password.value.length < 8) return showError(err, "Пароль должен быть не короче 8 символов.");
    if (role === "parent" && !f.child.value.trim()) return showError(err, "Укажите ФИО ребёнка.");
    if (!f.consent.checked) return showError(err, "Без согласия на обработку данных регистрация невозможна.");

    const user = { id: uid("u"), role, name: f.name.value.trim(), email, phone: f.phone.value.trim(), status: role === "medic" ? "pending" : "active" };
    if (role === "parent") {
      const child = { id: uid("s"), name: f.child.value.trim(), age: Number(f.age.value), cls: f.cls.value.trim() || "—", school: f.schoolP.value, card: null };
      STATE.students.push(child);
      user.childId = child.id;
    } else {
      user.school = f.schoolM.value;
      user.position = f.position.value.trim() || "Медработник";
    }
    STATE.users.push(user);
    signIn(user.id);
  });
}

// ---------- Вход ----------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("loginError");
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const user = STATE.users.find((u) => u.email === email);
    if (!user) return showError(err, "Пользователь с таким email не найден. Проверьте адрес или зарегистрируйтесь.");
    if (user.status === "blocked") return showError(err, "Доступ отключён администратором.");
    signIn(user.id); // демо: пароль не проверяется
  });
  document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => signIn(b.dataset.demo)));
  document.getElementById("resetDemo").addEventListener("click", () => { Store.reset(); STATE = Store.load(); location.reload(); });
}

// ---------- Кабинет ----------
const cabinet = document.getElementById("cabinet");

const RECS = {
  0: `<p>Факторов риска не выявлено. Продолжайте следить за режимом: прогулки не меньше 90 минут в день, гаджеты не больше 1,5 часа.</p>`,
  1: `<p>Есть один фактор риска. Рекомендации:</p><ul class="ticks"><li>Гимнастика для глаз — 5–7 минут ежедневно.</li><li>Прогулки на улице — не меньше 90 минут в день.</li><li>Ограничить гаджеты до 1,5 часа в день.</li></ul>`,
  2: `<p>Сочетание нескольких факторов риска. Рекомендации:</p><ul class="ticks"><li>Гимнастика для глаз — 5–7 минут ежедневно.</li><li>Упражнение «Метка на стекле»: курс 15–20 дней, 2 раза в день.</li><li>Больше времени на улице, меньше — с гаджетами.</li></ul>`,
  3: `<p><b>Нужен визит к офтальмологу.</b> Медработник школы отметил признаки, которые требуют осмотра специалиста.</p><p>Контакты офтальмологической службы — на <a href="https://okob.vrn.ru" target="_blank" rel="noopener">okob.vrn.ru</a>.</p>`,
};

const badge = (card) => card ? `<span class="risk ${RISK_LEVELS[riskLevel(card)].cls}">${RISK_LEVELS[riskLevel(card)].label}</span>` : `<span class="risk risk--none">Карта не заполнена</span>`;

function renderCabinet() {
  const u = currentUser();
  if (!u) {
    cabinet.innerHTML = `<div class="card empty"><h3>Вы не вошли</h3><p class="muted">Войдите или зарегистрируйтесь, чтобы открыть личный кабинет.</p>
      <div class="hero__btns"><a class="btn btn--primary" href="login.html">Войти</a><a class="btn btn--outline" href="register.html">Регистрация</a></div></div>`;
    return;
  }
  if (u.role === "admin") { location.href = "admin.html"; return; }
  const roleName = u.role === "parent" ? "Родитель" : "Медработник школы";
  const head = `<div class="cab-head"><div><p class="eyebrow eyebrow--teal">${roleName}</p><h2>${esc(u.name)}</h2>
    <p class="muted">${esc(u.email)}${u.school ? " · " + esc(u.school) : ""}</p></div>
    <button class="btn btn--outline" id="logout">Выйти</button></div>`;
  cabinet.innerHTML = head + (u.role === "parent" ? parentView(u) : medicView(u));
  document.getElementById("logout").addEventListener("click", signOut);
  if (u.role === "medic" && u.status === "active") bindMedic(u);
}

function parentView(u) {
  const c = STATE.students.find((s) => s.id === u.childId);
  if (!c) return `<div class="card"><p>Ребёнок не найден.</p></div>`;
  const lvl = c.card ? riskLevel(c.card) : null;
  return `<div class="grid2">
    <div class="card">
      <h3>Мой ребёнок</h3>
      <dl class="dl"><dt>ФИО</dt><dd>${esc(c.name)}</dd><dt>Школа, класс</dt><dd>${esc(c.school)}, ${esc(c.cls)}</dd>
      <dt>Возраст</dt><dd>${c.age} лет</dd><dt>Скрининг по графику</dt><dd>${SCHEDULE[c.age] || "—"} 2026/2027</dd>
      <dt>Результат</dt><dd>${badge(c.card)}${c.card ? ` <span class="muted">от ${esc(c.card.date)}</span>` : ""}</dd></dl>
    </div>
    <div class="card ${lvl === 3 ? "card--alert" : "card--goal"}">
      <h3>Рекомендации</h3>
      ${lvl === null ? `<p>Карту предикторов заполнит медработник школы во время скрининга. Результат появится здесь.</p>` : RECS[lvl]}
    </div>
  </div>`;
}

function medicView(u) {
  if (u.status !== "active") {
    return `<div class="card card--alert"><h3>Заявка на проверке</h3><p>Администратор проекта проверит данные и откроет доступ к спискам учеников ${esc(u.school)}.</p></div>`;
  }
  return `<div class="cab-medic">
    <div class="card"><h3>Ученики · ${esc(u.school)}</h3><p class="muted">Выберите ученика, чтобы заполнить карту предикторов.</p>
      <div class="table-scroll"><table class="tbl" id="students"></table></div></div>
    <div class="card" id="cardPanel"><h3>Карта предикторов миопии</h3><p class="muted">Ученик не выбран.</p></div>
  </div>`;
}

function bindMedic(u) {
  const table = document.getElementById("students"), panel = document.getElementById("cardPanel");
  const list = () => STATE.students.filter((s) => s.school === u.school);
  const drawTable = (activeId) => {
    table.innerHTML = `<thead><tr><th>Ученик</th><th>Класс</th><th>Возраст</th><th>Результат</th></tr></thead><tbody>` +
      list().map((s) => `<tr data-id="${s.id}" class="${s.id === activeId ? "is-active" : ""}" tabindex="0"><td>${esc(s.name)}</td><td>${esc(s.cls)}</td><td>${s.age}</td><td>${badge(s.card)}</td></tr>`).join("") + `</tbody>`;
  };
  const open = (id) => {
    const s = STATE.students.find((x) => x.id === id), c = s.card || {};
    drawTable(id);
    const box = (name, title, hint) => `<label class="check"><input type="checkbox" name="${name}" ${c[name] ? "checked" : ""}><span>${title}<small>${hint}</small></span></label>`;
    panel.innerHTML = `<h3>Карта предикторов миопии</h3><p><b>${esc(s.name)}</b>, ${esc(s.cls)}</p>
      <form id="predictors" class="form">
        <p class="form__group">Заполняет ребёнок <small>1 уровень; сочетание факторов — 2</small></p>
        ${box("outdoor", "Мало времени гуляет", "менее 90 минут в день")}
        ${box("gadgets", "Много времени использует гаджеты", "более 1,5 часа в день")}
        ${box("parents", "Один или оба родителя носят очки или линзы", "чтобы хорошо видеть вдаль")}
        <p class="form__group form__group--med">Заполняет медработник <small>3 уровень</small></p>
        ${box("eyeMovement", "Нарушения движений глаз или бинокулярного зрения", "или ослабление конвергенции")}
        ${box("malinovsky", "Положительный тест Малиновского", "с линзами +0,5 дптр ребёнок перестаёт видеть 10-ю строку")}
        <p>Итог: <span id="predResult"></span></p>
        <button class="btn btn--primary" type="submit">Сохранить карту</button>
        <p class="form__ok" id="predSaved" hidden>Сохранено. Результат и рекомендации появились в кабинете родителя.</p>
      </form>`;
    const form = document.getElementById("predictors");
    const read = () => Object.fromEntries(["outdoor", "gadgets", "parents", "eyeMovement", "malinovsky"].map((k) => [k, form[k].checked]));
    const upd = () => { document.getElementById("predResult").innerHTML = badge(read()); };
    form.addEventListener("change", upd); upd();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      s.card = { ...read(), date: today() }; commit(); drawTable(id);
      document.getElementById("predSaved").hidden = false;
    });
  };
  table.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) open(tr.dataset.id); });
  table.addEventListener("keydown", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr && e.key === "Enter") open(tr.dataset.id); });
  drawTable();
}

if (cabinet) renderCabinet();
