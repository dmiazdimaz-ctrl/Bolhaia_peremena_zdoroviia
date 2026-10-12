// Заявка родителей «Пригласить БПЗ в школу» (демо: сохраняется в localStorage, видна администратору).
const requestForm = document.getElementById("requestForm");
if (requestForm) {
  requestForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (id) => document.getElementById(id).value.trim();
    const err = document.getElementById("rqError");
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    const phoneDigits = val("rqPhone").replace(/\D/g, "");
    if (!val("rqName")) return fail("Укажите, как к вам обращаться.");
    if (phoneDigits.length < 10) return fail("Проверьте телефон: нужно не меньше 10 цифр.");
    if (val("rqEmail") && !document.getElementById("rqEmail").checkValidity()) return fail("Проверьте email: в нём должна быть «@».");
    if (!val("rqSchool")) return fail("Укажите школу.");
    if (!document.getElementById("rqConsent").checked) return fail("Без согласия на обработку контактов мы не сможем с вами связаться.");
    STATE.requests = STATE.requests || [];
    STATE.requests.unshift({
      id: uid("r"), date: today(), name: val("rqName"), phone: val("rqPhone"), email: val("rqEmail"),
      district: val("rqDistrict"), school: val("rqSchool"),
      ages: [...requestForm.querySelectorAll('input[name="age"]:checked')].map((c) => c.value),
      comment: val("rqComment"), status: "new",
    });
    commit();
    requestForm.hidden = true;
    document.getElementById("rqDone").hidden = false;
  });
}
