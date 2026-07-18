// 仅用于召回人工安全审核，命中不等于现代毒理学结论。
export const safetyReviewTermsVersion = "2026-07-17.1";
export const safetyReviewTerms = ["附子", "乌头", "巴豆", "甘遂", "大戟", "芫花", "半夏", "细辛", "雄黄", "蜀椒", "杏仁", "桃仁", "虻虫", "水蛭", "麻黄"];

export function safetyReviewMatches(formula) {
  const substances = formula.ingredients.map((item) => item.substance ?? "");
  return safetyReviewTerms.filter((term) => substances.some((substance) => substance.includes(term)));
}
