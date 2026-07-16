export const normalizedIngredient = (ingredient) => [
  ingredient.substance,
  ingredient.dose_original ?? "",
  ingredient.preparation ?? ""
].join("|");

export const ingredientsEqual = (source, target) =>
  JSON.stringify(source.map(normalizedIngredient)) === JSON.stringify(target.map(normalizedIngredient));
