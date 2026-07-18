document.documentElement.classList.replace("no-js", "js");
const items = [...document.querySelectorAll("article")];
const q = document.querySelector("#q");
const edition = document.querySelector("#edition");
const paired = document.querySelector("#paired");
const count = document.querySelector("#count");
function filter() {
  const needle = q.value.trim().normalize("NFC").toLowerCase();
  let visible = 0;
  for (const item of items) {
    const show = (!needle || item.dataset.search.normalize("NFC").toLowerCase().includes(needle)) && (!edition.value || item.dataset.edition === edition.value) && (!paired.value || item.dataset.paired === paired.value);
    item.hidden = !show;
    if (show) visible++;
  }
  count.textContent = `当前页显示 ${visible} / ${items.length} 条`;
  const params = new URLSearchParams();
  if (q.value) params.set("q", q.value); if (edition.value) params.set("edition", edition.value); if (paired.value) params.set("paired", paired.value);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}
const params = new URLSearchParams(location.search);
q.value = params.get("q") || ""; edition.value = params.get("edition") || ""; paired.value = params.get("paired") || "";
q.addEventListener("input", filter); edition.addEventListener("change", filter); paired.addEventListener("change", filter); filter();
