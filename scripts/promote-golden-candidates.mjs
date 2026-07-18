#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateGoldenCandidate } from "../lib/golden-promotion.mjs";

const inputPath = process.argv[2] ?? "data/review/golden-candidates.json";
const outputPath = process.argv[3] ?? inputPath;
const registryPath = process.argv[4] ?? "data/review/reviewer-registry.json";
const data = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const registryData = JSON.parse(await readFile(resolve(registryPath), "utf8"));
const reviewerRegistry = new Map(registryData.reviewers.map((reviewer) => [reviewer.id, reviewer]));
for (const candidate of data.candidates) {
  const result = evaluateGoldenCandidate(candidate, reviewerRegistry);
  candidate.review_state = result.state;
  candidate.golden_status = result.status;
  candidate.reviewed_relation_type = result.reviewed_relation_type ?? null;
}
await writeFile(resolve(outputPath), `${JSON.stringify(data, null, 2)}\n`);
const counts = Object.groupBy(data.candidates, (item) => item.golden_status);
console.log(`候选 ${counts.candidate?.length ?? 0}；黄金样本 ${counts.golden?.length ?? 0}；驳回 ${counts.rejected?.length ?? 0}`);
