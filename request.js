// Заявка родителей «Пригласить БПЗ в школу».
const requestForm = document.getElementById("requestForm");
if (requestForm) {
  Store.isDemo().then((d) => { document.getElementById("rqDemo").hidden = !d; });
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (id) => document.getElementById(id).value.trim();
    const err = document.getElementById("rqError"), btn = document.getElementById("rqSubmit");
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    err.hidden = true;
    if (!val("rqName")) return fail("Укажите, как к вам обращаться.");
    if (val("rqPhone").replace(/\D/g, "").length < 10) return fail("Проверьте телефон: нужно не меньше 10 цифр.");
    if (val("rqEmail") && !document.getElementById("rqEmail").checkValidity()) return fail("Проверьте email: в нём должна быть «@».");
    if (!val("rqSchool")) return fail("Укажите школу.");
    if (!document.getElementById("rqConsent").checked) return fail("Без согласия на обработку контактов мы не сможем с вами связаться.");
    btn.disabled = true; btn.textContent = "Отправляем…";
    try {
      await Store.submitRequest({
        name: val("rqName"), phone: val("rqPhone"), email: val("rqEmail"), district: val("rqDistrict"), school: val("rqSchool"),
        ages: [...requestForm.querySelectorAll('input[name="age"]:checked')].map((c) => c.value),
        comment: val("rqComment"), consent: true, website: val("rqWebsite"),
      });
      requestForm.hidden = true;
      document.getElementById("rqDone").hidden = false;
    } catch (ex) {
      fail(ex.message);
    } finally {
      btn.disabled = false; btn.textContent = "Отправить заявку";
    }
  });
}
