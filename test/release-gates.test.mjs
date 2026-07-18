import test from "node:test";
import assert from "node:assert/strict";
import { dataPackageRightsErrors, goldenReleaseErrors, rightsReleaseErrors, uncoveredPublicArtifactErrors } from "../lib/release-gates.mjs";

test("NOASSERTION来源不得进入公开产物", () => {
  const errors = rightsReleaseErrors({ schema_version: 1, sources: [{
    id: "unknown-source", rights_status: "NOASSERTION", evidence_refs: [], public_artifact_paths: ["docs/site/report.html"]
  }] });
  assert.match(errors.join("\n"), /不得进入公开产物/);
});

test("已清权利必须有证据且路径位于公开根目录", () => {
  const evidence = { path: "LICENSE", sha256: "a".repeat(64), approval_status: "approved" };
  assert.equal(rightsReleaseErrors({ schema_version: 1, sources: [{
    id: "code", rights_status: "cleared", evidence_refs: [evidence], public_artifact_paths: ["docs/site/site.css"]
  }] }, "docs/site", new Map([["LICENSE", "a".repeat(64)]])).length, 0);
  const errors = rightsReleaseErrors({ schema_version: 1, sources: [{
    id: "code", rights_status: "cleared", evidence_refs: [], public_artifact_paths: ["README.md"]
  }] });
  assert.equal(errors.length, 2);
});

test("excluded来源不得覆盖公开文件", () => {
  const manifest = { schema_version: 1, sources: [{ id: "excluded", rights_status: "excluded", evidence_refs: [], public_artifact_paths: ["docs/site/index.html"] }] };
  assert.match(rightsReleaseErrors(manifest).join("\n"), /仍登记公开产物/);
  assert.match(uncoveredPublicArtifactErrors(manifest, ["docs/site/index.html"]).join("\n"), /未登记权利来源/);
});

test("伪造权利证据和删除数据来源绑定均失败", () => {
  const cleared = { schema_version: 1, sources: [{ id: "project", rights_status: "cleared", evidence_refs: [{ path: "fake", sha256: "b".repeat(64), approval_status: "approved" }], public_artifact_paths: [] }] };
  assert.match(rightsReleaseErrors(cleared).join("\n"), /不存在或哈希不一致/);
  const packages = new Map([["data/imported/source.json", { source_id: "source:1", source_sha256: "c".repeat(64) }]]);
  assert.match(dataPackageRightsErrors(cleared, packages).join("\n"), /未绑定权利来源/);
});

test("数据包来源ID和SHA必须与权利清单一致", () => {
  const manifest = { sources: [{ id: "source-entry" }], data_packages: [{ path: "data/imported/source.json", source_entry_id: "source-entry", source_id: "source:1", source_sha256: "c".repeat(64) }] };
  const valid = new Map([["data/imported/source.json", { source_id: "source:1", source_sha256: "c".repeat(64) }]]);
  assert.deepEqual(dataPackageRightsErrors(manifest, valid), []);
  const wrong = new Map([["data/imported/source.json", { source_id: "source:other", source_sha256: "c".repeat(64) }]]);
  assert.match(dataPackageRightsErrors(manifest, wrong).join("\n"), /来源ID或SHA/);
});

test("公开目录中的新增文件不得绕过权利清单", () => {
  const manifest = { sources: [{ public_artifact_paths: ["docs/site/index.html"] }] };
  assert.deepEqual(uncoveredPublicArtifactErrors(manifest, ["docs/site/index.html"]), []);
  assert.match(uncoveredPublicArtifactErrors(manifest, ["docs/site/index.html", "docs/site/new.js"])[0], /new\.js/);
});

const review = (reviewer_id) => ({ reviewer_id, decision: "accept", proposed_relation_type: "approximate", evidence_refs: ["source:page-1"], reviewed_at: "2026-07-18T00:00:00Z" });
const golden = { candidates: [{ alignment_id: "a1", first_review: review("first"), second_review: review("second"), reviewed_relation_type: "approximate", golden_status: "golden" }] };
const registry = (firstActive = true) => ({ reviewers: [
  { id: "first", active: firstActive, verified_at: "2026-07-18T00:00:00Z", roles: ["first_review"], conflict_alignment_ids: [] },
  { id: "second", active: true, verified_at: "2026-07-18T00:00:00Z", roles: ["second_review"], conflict_alignment_ids: [] }
] });

test("发布时按当前注册表重新验证黄金样本", () => {
  assert.deepEqual(goldenReleaseErrors(golden, registry()), []);
  assert.match(goldenReleaseErrors(golden, registry(false)).join("\n"), /未通过有效身份/);
});

test("审核者注册表拒绝重复身份", () => {
  const duplicate = registry();
  duplicate.reviewers.push({ ...duplicate.reviewers[0] });
  assert.match(goldenReleaseErrors({ candidates: [] }, duplicate).join("\n"), /重复 ID/);
});

test("非黄金候选不要求审核身份", () => {
  assert.deepEqual(goldenReleaseErrors({ candidates: [{ golden_status: "candidate" }] }, { reviewers: [] }), []);
});
