import { isAbsolute, relative, resolve, sep } from "node:path";

export function resolveInside(root, candidate) {
  if (!candidate || isAbsolute(candidate)) throw new Error("来源路径必须是相对路径");
  const absoluteRoot = resolve(root);
  const absoluteTarget = resolve(candidate);
  const rel = relative(absoluteRoot, absoluteTarget);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`来源路径必须位于 ${root} 内: ${candidate}`);
  return absoluteTarget;
}
