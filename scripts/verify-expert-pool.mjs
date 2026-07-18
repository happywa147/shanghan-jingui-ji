#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const plan = JSON.parse(await readFile(resolve("data/review/expert-pool-plan.json"), "utf8"));
const registry = JSON.parse(await readFile(resolve("data/review/reviewer-registry.json"), "utf8"));
const errors = [];
if (plan.target_size !== 5 || plan.slots?.length !== 5) errors.push("专家池必须配置五席");
if (new Set(plan.slots?.map((item) => item.slot)).size !== 5) errors.push("专家池席位重复");
if (plan.filled !== registry.reviewers.length) errors.push("专家池实到人数与注册表不一致");
if (plan.slots.some((item) => item.status !== "vacant") && registry.reviewers.length === 0) errors.push("没有真人注册记录却标记席位已占用");
if (!plan.rule.includes("AI预审不得占用真人席位")) errors.push("缺少AI与真人隔离规则");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`真人专家池计划通过：目标${plan.target_size}席，已核验${plan.filled}人，空缺${plan.target_size - plan.filled}席`);
