document.documentElement.classList.replace("no-js", "js");
const storageKey = "shanghan-jingui-ji:alignment-reviews:v3";
const legacyKey = "shanghan-jingui-ji:alignment-reviews:v2";
const ttlMs = 90 * 24 * 60 * 60 * 1000;
const maxNoteLength = 4000;
const maxReviews = 2000;
const articles = [...document.querySelectorAll("article")];
const query = document.querySelector("#query");
const edition = document.querySelector("#edition");
const reviewFilter = document.querySelector("#review-filter");
const count = document.querySelector("#count");
const saveStatus = document.querySelector("#save-status");
let reviews = {};
let saveTimer;
let clearBackup;

function validReview(value) {
  return value && ["unreviewed", "confirmed", "rejected", "needs_work"].includes(value.status) && typeof value.note === "string" && value.note.length <= maxNoteLength && Array.isArray(value.evidence_refs) && value.evidence_refs.length <= 20;
}

function loadReviews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!parsed || parsed.schema_version !== 3 || Date.now() - Date.parse(parsed.saved_at) > ttlMs || typeof parsed.reviews !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.reviews).filter(([id, value]) => typeof id === "string" && validReview(value)).slice(0, maxReviews));
  } catch {
    localStorage.removeItem(storageKey);
    return {};
  }
}

function persist() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ schema_version: 3, saved_at: new Date().toISOString(), reviews }));
    localStorage.removeItem(legacyKey);
    saveStatus.textContent = `已保存于本机 ${new Date().toLocaleTimeString("zh-CN")}`;
  } catch {
    saveStatus.textContent = "保存失败：本地空间不足或已被禁用，请立即导出。";
  }
}

function scheduleSave() {
  saveStatus.textContent = "正在保存…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

function apply(item) {
  const review = reviews[item.dataset.id] || { status: "unreviewed", note: "", evidence_refs: [] };
  const evidence = review.evidence_refs[0] || {};
  item.querySelector(".status").value = review.status;
  item.querySelector(".review-note").value = review.note;
  item.querySelector(".evidence-source").value = evidence.source_id || "";
  item.querySelector(".evidence-locator").value = evidence.locator || "";
  item.querySelector(".evidence-url").value = evidence.url || "";
  item.dataset.review = review.status;
}

function updateUrl() {
  const params = new URLSearchParams();
  if (query.value) params.set("q", query.value);
  if (edition.value) params.set("edition", edition.value);
  if (reviewFilter.value) params.set("status", reviewFilter.value);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function filter(update = true) {
  const q = query.value.trim().normalize("NFC").toLowerCase();
  const stats = { unreviewed: 0, confirmed: 0, rejected: 0, needs_work: 0 };
  let visible = 0;
  for (const item of articles) {
    stats[item.dataset.review]++;
    const show = (!edition.value || item.dataset.edition === edition.value) && (!reviewFilter.value || item.dataset.review === reviewFilter.value) && (!q || item.dataset.search.normalize("NFC").toLowerCase().includes(q));
    item.hidden = !show;
    if (show) visible++;
  }
  count.textContent = `当前页匹配 ${visible} / ${articles.length}；已确认 ${stats.confirmed}，已否决 ${stats.rejected}，待校 ${stats.needs_work}，未审核 ${stats.unreviewed}`;
  if (update) updateUrl();
}

reviews = loadReviews();
for (const item of articles) apply(item);
const params = new URLSearchParams(location.search);
query.value = params.get("q") || "";
edition.value = params.get("edition") || "";
reviewFilter.value = params.get("status") || "";
filter(false);

document.querySelector("main").addEventListener("change", (event) => {
  const item = event.target.closest("article");
  if (!item || !event.target.matches(".status")) return;
  reviews[item.dataset.id] = { status: event.target.value, note: reviews[item.dataset.id]?.note || "", evidence_refs: reviews[item.dataset.id]?.evidence_refs || [], updated_at: new Date().toISOString() };
  apply(item); scheduleSave(); filter();
});
document.querySelector("main").addEventListener("input", (event) => {
  const item = event.target.closest("article");
  if (!item || !event.target.matches(".review-note,.evidence-source,.evidence-locator,.evidence-url")) return;
  const current = reviews[item.dataset.id] || { status: "unreviewed", note: "", evidence_refs: [] };
  const sourceId = item.querySelector(".evidence-source").value.trim();
  const locator = item.querySelector(".evidence-locator").value.trim();
  const url = item.querySelector(".evidence-url").value.trim();
  const evidence = sourceId || locator || url ? [{ source_id: sourceId, locator, ...(url ? { url } : {}) }] : [];
  reviews[item.dataset.id] = { status: current.status, note: item.querySelector(".review-note").value.slice(0, maxNoteLength), evidence_refs: evidence, updated_at: new Date().toISOString() };
  scheduleSave();
});

document.querySelector("#export").addEventListener("click", () => {
  const reviewerId = document.querySelector("#reviewer").value.trim();
  if (!reviewerId) { saveStatus.textContent = "请先填写审核者标识。"; document.querySelector("#reviewer").focus(); return; }
  const incomplete = Object.entries(reviews).find(([, review]) => review.status !== "unreviewed" && (!review.evidence_refs?.[0]?.source_id || !review.evidence_refs?.[0]?.locator));
  if (incomplete) { const item = document.getElementById(incomplete[0]); saveStatus.textContent = `条目 ${incomplete[0]} 缺少来源ID或定位，不能导出。`; if (item) item.querySelector(".evidence-source").focus(); return; }
  persist();
  const payload = { schema_version: 2, exported_at: new Date().toISOString(), reviewer: { id: reviewerId, role: document.querySelector("#role").value, identity_verified: false }, input_revision: document.querySelector("main").dataset.inputRevision, reviews };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  link.download = "伤寒金匮集-对照审核.json"; link.click(); URL.revokeObjectURL(link.href);
  saveStatus.textContent = `已导出 ${Object.keys(reviews).length} 条本地草稿；仍未提交或获批。`;
});

document.querySelector("#clear").addEventListener("click", () => {
  document.querySelector("#clear-summary").textContent = `将清除 ${Object.keys(reviews).length} 条本地草稿。此操作不会影响服务器数据。`;
  document.querySelector("#clear-confirm").hidden = false;
  document.querySelector("#clear-yes").focus();
});
document.querySelector("#clear-no").addEventListener("click", () => { document.querySelector("#clear-confirm").hidden = true; document.querySelector("#clear").focus(); });
document.querySelector("#clear-yes").addEventListener("click", () => {
  clearBackup = structuredClone(reviews); reviews = {}; persist();
  for (const item of articles) apply(item); filter();
  document.querySelector("#clear-confirm").hidden = true; document.querySelector("#undo-bar").hidden = false; document.querySelector("#undo-clear").focus();
});
document.querySelector("#undo-clear").addEventListener("click", () => {
  reviews = clearBackup || {}; clearBackup = undefined; persist();
  for (const item of articles) apply(item); filter();
  document.querySelector("#undo-bar").hidden = true; document.querySelector("#clear").focus();
});
document.querySelector("#next-unreviewed").addEventListener("click", () => {
  const next = articles.find((item) => !item.hidden && item.dataset.review === "unreviewed");
  if (!next) { saveStatus.textContent = "当前页和筛选条件下已无未审核条目。"; return; }
  next.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  next.querySelector(".status").focus();
});
query.addEventListener("input", filter); edition.addEventListener("change", filter); reviewFilter.addEventListener("change", filter);
