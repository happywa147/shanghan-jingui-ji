import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const catalog = read("data/sources/edition-catalog.json");
const shanghan = read("data/imported/liwengtang-shanghan.json");
const jingui = read("data/imported/jingui-wikisource.json");
const golden = read("data/review/golden-candidates.json");

const selected = catalog.works.flatMap((work) => work.editions
  .filter((edition) => edition.selected)
  .map((edition) => ({ ...edition, work_id: work.work_id })));
if (selected.length !== 6 || selected.filter((item) => item.work_id === "jingui_yaolue").length !== 3) {
  throw new Error("版本目录必须恰好选定两书各3个主本");
}

const editions = selected.map((edition) => {
  const reasons = [];
  if (/pending|needs_page_range|verify/i.test(`${edition.text_status} ${edition.completeness}`)) reasons.push(edition.risk);
  const transcriptionOnly = edition.text_status === "fixed_revision_transcription_imported" || edition.edition_id.startsWith("shanghan:");
  if (transcriptionOnly) reasons.push("当前文本没有逐条绑定扫描页码，不能视为影像核验本");
  return {
    edition_id: edition.edition_id,
    work_id: edition.work_id,
    ocr_layer: {
      state: reasons.length ? (transcriptionOnly ? "transcription_only" : "blocked") : "ready_for_ocr",
      source_binding_required: true,
      page_fields: ["source_sha256", "page", "folio", "text", "engine", "engine_version", "requires_human_review"],
      immutable_machine_output: true
    },
    structure_layer: {
      levels: ["chapter", "text_unit", "formula"],
      text_layers: ["base_text", "commentary", "editorial_note"],
      state: reasons.length ? "blocked" : "candidate"
    },
    blocking_reasons: reasons
  };
});

const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const missingImageLocator = () => ({
  status: "missing", source_file: null, source_sha256: null,
  page: null, folio: null, region: null, verified_by_human: false
});
const shanghanUnits = shanghan.text_units
  .filter((unit) => clean(unit.source_edited_text).length >= 20)
  .slice(0, 50);
if (shanghanUnits.length !== 50) throw new Error("《伤寒论》不足50条锚点候选");

const jinguiSegments = jingui.parts.flatMap((part) => String(part.text || "").split(/(?<=[。！？；])|\n+/)
  .map(clean).filter((text) => text.length >= 18)
  .map((text, index) => ({ part: part.part, revision_id: part.revision_id, index: index + 1, text })));
if (jinguiSegments.length < 50) throw new Error("《金匮要略》固定修订转录不足50条锚点候选");

const anchors = [
  ...shanghanUnits.map((unit, index) => ({
    anchor_id: `anchor:shanghan_lun:${String(index + 1).padStart(3, "0")}`,
    work_id: "shanghan_lun", edition_id: unit.edition_id,
    source_locator: unit.source_record_locator,
    image_locator: missingImageLocator(),
    text_excerpt: clean(unit.source_edited_text).slice(0, 300),
    candidate_kind: unit.chapter ? "text_unit" : "chapter",
    state: "blocked_missing_scan_locator", blocking_reasons: ["来源记录尚未绑定扫描文件、页码与版面区域"], requires_human_review: true
  })),
  ...jinguiSegments.slice(0, 50).map((segment, index) => ({
    anchor_id: `anchor:jingui_yaolue:${String(index + 1).padStart(3, "0")}`,
    work_id: "jingui_yaolue", edition_id: "jingui:sibu-yuqiao",
    source_locator: `${segment.part}@oldid=${segment.revision_id}#segment-${segment.index}`,
    image_locator: missingImageLocator(),
    text_excerpt: segment.text.slice(0, 300), candidate_kind: "text_unit",
    state: "blocked_missing_scan_locator", blocking_reasons: ["固定修订转录尚未绑定四部丛刊扫描页码与版面区域"], requires_human_review: true
  }))
];

const structureCandidates = anchors.map((anchor) => ({
  candidate_id: `structure:${anchor.anchor_id.slice(7)}`,
  work_id: anchor.work_id, source_locator: anchor.source_locator,
  level: anchor.candidate_kind, text_layer: "undetermined",
  evidence: [anchor.text_excerpt], requires_human_review: true
}));

const glyphPattern = /\[图字:|�|□|〓|⿰|⿱|𬒳/u;
const commentaryPattern = /(?:臣曰|按曰|注文|方见|校曰|又云|謹按|谨按)/u;
const goldenRemediation = golden.candidates.map((candidate) => {
  const combined = `${candidate.source_text}\n${candidate.target_text}`;
  const flags = ["scan_locator_missing"];
  if (candidate.relation_type === "exact" || (candidate.relation_type === "approximate" && candidate.difference_ratio === 0)) flags.push("exact_label_risk");
  if (["merge", "split"].includes(candidate.relation_type) || /\n/.test(candidate.source_text)) flags.push("split_merge_risk");
  if (glyphPattern.test(combined)) flags.push("missing_glyph_risk");
  if (commentaryPattern.test(combined)) flags.push("commentary_mixing_risk");
  const recommendations = ["补齐双方扫描文件、页码和版面区域后，由两名真人专家独立复核"];
  if (flags.includes("exact_label_risk")) recommendations.push(candidate.relation_type === "approximate" ? "文本差异率为0；逐字核验后判断是否应由 approximate 改为 exact" : "撤回自动 exact 结论，逐字核验后再确定关系类型");
  if (flags.includes("split_merge_risk")) recommendations.push("核对条文边界，分别判断一对多、多对一或来源重复");
  if (flags.includes("missing_glyph_risk")) recommendations.push("对图片字、缺字或占位符逐页释读并保留字形证据");
  if (flags.includes("commentary_mixing_risk")) recommendations.push("拆分仲景正文、后人注文和编校说明，禁止合并入正文层");
  return { alignment_id: candidate.alignment_id, ai_precheck_only: true, risk_flags: [...new Set(flags)], recommendations, must_not_promote_before_human_review: true };
});

const output = {
  schema_version: 1,
  generated_at: `${catalog.retrieved_at}T00:00:00.000Z`,
  generator: "scripts/generate-collation-preflight.mjs",
  policy: "本包只提供AI预审候选；不填写、不替代、不推断真人审核字段。所有锚点须绑定影像页后才可晋级。",
  editions, anchors, structure_candidates: structureCandidates, golden_remediation: goldenRemediation
};
const target = path.join(root, "data/review/collation-preflight.json");
const temporaryTarget = `${target}.${process.pid}.tmp`;
fs.writeFileSync(temporaryTarget, `${JSON.stringify(output, null, 2)}\n`);
fs.renameSync(temporaryTarget, target);
console.log(`已生成：6主本、${anchors.length}条锚点候选、${goldenRemediation.length}条黄金整改建议`);
