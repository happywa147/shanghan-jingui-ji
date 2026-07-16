export const normalizedIngredient = (ingredient) => [
  ingredient.substance,
  ingredient.dose_original ?? "",
  ingredient.preparation ?? ""
].join("|");

export const ingredientsEqual = (source, target) =>
  JSON.stringify(source.map(normalizedIngredient)) === JSON.stringify(target.map(normalizedIngredient));

const normalizeEditorialText = (value) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[\s，。；：！？、,. ;:!?]/gu, "");

export function formulaDifferences(source, target) {
  const differences = new Set();
  if (source.ingredients.length !== target.ingredients.length) differences.add("ingredient_count");
  const length = Math.min(source.ingredients.length, target.ingredients.length);
  for (let index = 0; index < length; index++) {
    const left = source.ingredients[index];
    const right = target.ingredients[index];
    if (left.substance !== right.substance) differences.add("substance_or_order");
    if ((left.dose_original ?? "") !== (right.dose_original ?? "")) differences.add("dose");
    if ((left.preparation ?? "") !== (right.preparation ?? "")) differences.add("preparation");
  }
  const sourceUsage = source.preparation_and_use ?? "";
  const targetUsage = target.preparation_and_use ?? "";
  if (sourceUsage !== targetUsage) {
    differences.add(normalizeEditorialText(sourceUsage) === normalizeEditorialText(targetUsage)
      ? "usage_punctuation"
      : "preparation_and_use");
  }
  return [...differences];
}
