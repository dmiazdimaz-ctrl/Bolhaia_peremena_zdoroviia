// Регистрация, вход и личный кабинет (демо).
document.querySelectorAll("[data-schools]").forEach((sel) => {
  sel.innerHTML = SCHOOLS.map((s) => `<option>${s}</option>`).join("");
});

function showError(el, text) { el.textContent = text; el.hidden = !text; }

// ---------- Регистрация ----------
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = registerForm, err = document.getElementById("regError");
    const email = f.email.value.trim().toLowerCase();
    if (!f.name.value.trim()) return showError(err, "Укажите ФИО.");
    if (!f.email.checkValidity() || !email) return showError(err, "Проверьте email: в нём должна быть «@».");
    if (STATE.users.some((u) => u.email === email)) return showError(err, "Этот email уже зарегистрирован. Войдите или укажите другой.");
    if (f.password.value.length < 8) return showError(err, "Пароль должен быть не короче 8 символов.");
    if (!f.consent.checked) return showError(err, "Без согласия на обработку данных регистрация невозможна.");

    const user = { id: uid("u"), role: "medic", name: f.name.value.trim(), email, phone: f.phone.value.trim(),
      school: f.schoolM.value, position: f.position.value.trim() || "Медработник", status: "pending" };
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

const badge = (lvl) => `<span class="risk ${RISK_LEVELS[lvl].cls}">${RISK_LEVELS[lvl].label}</span>`;
const REPORT_AGES = [8, 9, 11, 12, 13];

function renderCabinet() {
  const u = currentUser();
  if (!u) {
    cabinet.innerHTML = `<div class="card empty"><h3>Кабинет медработника школы</h3><p class="muted">Войдите или зарегистрируйтесь. Родителям кабинет не нужен — чтобы пригласить БПЗ в школу, <a href="request.html">оставьте заявку</a>.</p>
      <div class="hero__btns"><a class="btn btn--primary" href="login.html">Войти</a><a class="btn btn--outline" href="register.html">Регистрация</a></div></div>`;
    return;
  }
  if (u.role === "admin") { location.href = "admin.html"; return; }
  const roleName = "Медработник школы";
  const head = `<div class="cab-head"><div><p class="eyebrow eyebrow--teal">${roleName}</p><h2>${esc(u.name)}</h2>
    <p class="muted">${esc(u.email)}${u.school ? " · " + esc(u.school) : ""}</p></div>
    <button class="btn btn--outline" id="logout">Выйти</button></div>`;
  cabinet.innerHTML = head + medicView(u);
  document.getElementById("logout").addEventListener("click", signOut);
  if (u.role === "medic" && u.status === "active") bindMedic(u);
}

function medicView(u) {
  if (u.status !== "active") {
    return `<div class="card card--alert"><h3>Заявка на проверке</h3><p>Администратор проекта проверит данные и откроет доступ к отчётам ${esc(u.school)}.</p></div>`;
  }
  return `<p class="note">Имена детей в систему не вносятся. Карты предикторов заполняются на бумаге и передаются родителям, сюда — только итоги по классу.</p>
  <div class="card cab-reports"><h3>Отчёты по классам · ${esc(u.school)}</h3>
    <div class="table-scroll"><table class="tbl" id="reports"></table></div></div>
  <div class="cab-medic">
    <form class="card form" id="reportForm" novalidate></form>
  <div class="card calc">
    <h3>Калькулятор уровня риска</h3>
    <p class="muted">Помогает определить уровень по карте одного ребёнка. Ничего не сохраняется.</p>
    <form id="calc" class="calc__grid">
      <div class="calc__col">
        <p class="form__group">Заполняет ребёнок <small>1 уровень; сочетание — 2</small></p>
        ${box("outdoor", "Мало времени гуляет", "менее 90 минут в день")}
        ${box("gadgets", "Много времени использует гаджеты", "более 1,5 часа в день")}
        ${box("parents", "Один или оба родителя носят очки или линзы", "чтобы хорошо видеть вдаль")}
      </div>
      <div class="calc__col">
        <p class="form__group form__group--med">Заполняет медработник <small>3 уровень</small></p>
        ${box("eyeMovement", "Нарушения движений глаз или бинокулярного зрения", "или ослабление конвергенции")}
        ${box("malinovsky", "Положительный тест Малиновского", "с линзами +0,5 дптр ребёнок перестаёт видеть 10-ю строку")}
        <p class="calc__result">Итог: <span id="calcResult"></span> <button type="reset" class="link-btn">Очистить</button></p>
      </div>
    </form>
  </div>
  </div>`;
}

function box(name, title, hint) {
  return `<label class="check"><input type="checkbox" name="${name}"><span>${title}<small>${hint}</small></span></label>`;
}

function bindMedic(u) {
  const table = document.getElementById("reports"), form = document.getElementById("reportForm");
  const mine = () => STATE.reports.filter((r) => r.school === u.school);
  let editId = null;

  const drawTable = () => {
    const list = mine(), tot = sumLevels(list);
    const screened = list.reduce((a, r) => a + r.screened, 0), enrolled = list.reduce((a, r) => a + r.enrolled, 0);
    table.innerHTML = `<thead><tr><th>Класс</th><th>Возраст</th><th>Обследовано</th><th>Нет риска</th><th>1</th><th>2</th><th>3</th><th>Дата</th><th></th></tr></thead><tbody>` +
      (list.length ? list.map((r) => `<tr class="${r.id === editId ? "is-active" : ""}"><td><b>${esc(r.cls)}</b></td><td>${r.age}</td>
        <td>${r.screened} из ${r.enrolled}</td>${r.levels.map((v, i) => `<td><span class="num risk--${i}">${v}</span></td>`).join("")}
        <td>${esc(r.date)}</td><td class="tbl__act"><button class="btn btn--sm btn--outline" data-edit="${r.id}">Изменить</button><button class="btn btn--sm btn--outline" data-del="${r.id}" aria-label="Удалить отчёт ${esc(r.cls)}">✕</button></td></tr>`).join("")
        : `<tr><td colspan="9" class="muted">Отчётов пока нет. Добавьте первый класс в форме ниже.</td></tr>`) +
      `</tbody>` + (list.length ? `<tfoot><tr><td>Итого</td><td></td><td>${screened} из ${enrolled}</td>${tot.map((v) => `<td>${v}</td>`).join("")}<td></td><td></td></tr></tfoot>` : "");
  };

  const drawForm = () => {
    const r = STATE.reports.find((x) => x.id === editId) || { cls: "", age: 8, enrolled: "", screened: "", levels: ["", "", "", ""] };
    const num = (id, label, v) => `<label class="field"><span>${label}</span><input id="${id}" type="number" min="0" inputmode="numeric" value="${v}"></label>`;
    form.innerHTML = `<h3>${editId ? "Изменить отчёт · " + esc(r.cls) : "Отчёт по классу"}</h3>
      <div class="fields">
        <label class="field"><span>Класс</span><input id="rpCls" value="${esc(r.cls)}" placeholder="2А"></label>
        <label class="field"><span>Возраст</span><select id="rpAge">${REPORT_AGES.map((a) => `<option value="${a}" ${a === r.age ? "selected" : ""}>${a} лет</option>`).join("")}</select></label>
        ${num("rpEnrolled", "Учеников в классе", r.enrolled)}
        ${num("rpScreened", "Прошли скрининг", r.screened)}
      </div>
      <fieldset class="fields fields--levels"><legend>Из них по уровням риска</legend>
        ${r.levels.map((v, i) => num("rpL" + i, RISK_LEVELS[i].label.replace(" — к офтальмологу", ""), v)).join("")}
      </fieldset>
      <p class="hint" id="rpSum"></p>
      <p class="form__error" id="rpError" hidden></p>
      <div class="hero__btns"><button class="btn btn--primary" type="submit">${editId ? "Сохранить" : "Добавить класс"}</button>
      ${editId ? `<button class="btn btn--outline" type="button" id="rpCancel">Отмена</button>` : ""}</div>`;
    const sumHint = () => {
      const n = (id) => Number(document.getElementById(id).value) || 0;
      const sum = [0, 1, 2, 3].reduce((a, i) => a + n("rpL" + i), 0), scr = n("rpScreened");
      document.getElementById("rpSum").textContent = `Сумма по уровням: ${sum} из ${scr} обследованных.`;
    };
    form.oninput = sumHint; sumHint();
    if (editId) document.getElementById("rpCancel").onclick = () => { editId = null; drawForm(); drawTable(); };
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("rpError");
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    const n = (id) => document.getElementById(id).value === "" ? NaN : Number(document.getElementById(id).value);
    const cls = document.getElementById("rpCls").value.trim();
    const enrolled = n("rpEnrolled"), screened = n("rpScreened"), levels = [0, 1, 2, 3].map((i) => n("rpL" + i) || 0);
    if (!cls) return fail("Укажите класс, например 2А.");
    if (!(enrolled > 0)) return fail("Укажите, сколько учеников в классе.");
    if (!(screened >= 0) || screened > enrolled) return fail("Прошедших скрининг не может быть больше, чем учеников в классе.");
    if (levels.some((v) => v < 0 || !Number.isInteger(v))) return fail("Количество по уровням — целые числа от 0.");
    const sum = levels.reduce((a, v) => a + v, 0);
    if (sum !== screened) return fail(`Сумма по уровням (${sum}) должна совпадать с числом обследованных (${screened}).`);
    if (mine().some((r) => r.cls.toLowerCase() === cls.toLowerCase() && r.id !== editId)) return fail(`Отчёт по классу ${cls} уже есть — нажмите «Изменить» в таблице.`);
    const data = { cls, age: Number(document.getElementById("rpAge").value), enrolled, screened, levels, date: today() };
    if (editId) Object.assign(STATE.reports.find((r) => r.id === editId), data);
    else STATE.reports.push({ id: uid("c"), school: u.school, ...data });
    commit(); editId = null; drawForm(); drawTable();
  });

  table.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) { editId = ed.dataset.edit; drawForm(); drawTable(); form.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (del) {
      if (del.dataset.confirm) { STATE.reports = STATE.reports.filter((r) => r.id !== del.dataset.del); if (editId === del.dataset.del) editId = null; commit(); drawForm(); drawTable(); }
      else { del.dataset.confirm = "1"; del.textContent = "Удалить?"; }
    }
  });

  const calc = document.getElementById("calc");
  const updCalc = () => {
    const card = Object.fromEntries(["outdoor", "gadgets", "parents", "eyeMovement", "malinovsky"].map((k) => [k, calc[k].checked]));
    document.getElementById("calcResult").innerHTML = badge(riskLevel(card));
  };
  calc.addEventListener("change", updCalc);
  calc.addEventListener("reset", () => setTimeout(updCalc));
  updCalc();

  drawForm(); drawTable();
}

if (cabinet) renderCabinet();
