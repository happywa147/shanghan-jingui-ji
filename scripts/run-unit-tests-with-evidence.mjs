#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "dist/test-evidence/unit.json");
const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
const metric = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, "mu").exec(result.stdout ?? "")?.[1] ?? -1);
const evidence = {
  schema_version: 1,
  exit_code: result.status,
  tests: metric("tests"),
  passed: metric("pass"),
  failed: metric("fail"),
  skipped: metric("skipped"),
  cancelled: metric("cancelled"),
  todo: metric("todo")
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (result.status !== 0 || evidence.tests < 1 || evidence.failed !== 0 || evidence.passed < 1) process.exit(1);
