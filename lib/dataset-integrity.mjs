export function datasetIntegrityErrors(data) {
  const errors = [];
  const collections = ["editions", "text_units", "alignments", "formulas", "text_formula_links"];

  for (const name of collections) {
    if (!Array.isArray(data[name])) errors.push(`${name} 必须是数组`);
  }
  if (errors.length) return errors;

  const uniqueIndex = (records, name, key = "id") => {
    const index = new Map();
    for (const record of records) {
      const value = record[key];
      if (index.has(value)) errors.push(`${name} 存在重复 ${key}: ${value}`);
      else index.set(value, record);
    }
    return index;
  };

  const editions = uniqueIndex(data.editions, "editions");
  const units = uniqueIndex(data.text_units, "text_units");
  const alignments = uniqueIndex(data.alignments, "alignments");
  const formulas = uniqueIndex(data.formulas, "formulas");

  for (const unit of data.text_units) {
    const edition = editions.get(unit.edition_id);
    if (!edition) errors.push(`${unit.id} 引用了不存在的 edition_id: ${unit.edition_id}`);
    else if (edition.work_id !== unit.work_id) errors.push(`${unit.id} 与版本 work_id 不一致`);
    else if (edition.source_id !== undefined && edition.source_id !== unit.source_id) errors.push(`${unit.id} 与版本 source_id 不一致`);
  }
  for (const alignment of data.alignments) {
    const sourceSet = new Set(alignment.source_unit_ids);
    if (alignment.target_unit_ids.some((id) => sourceSet.has(id))) errors.push(`${alignment.id} 同一文本单元同时出现在两侧`);
    const sideEditions = [alignment.source_unit_ids, alignment.target_unit_ids].map((ids) => new Set(ids.map((id) => units.get(id)?.edition_id).filter(Boolean)));
    if (sideEditions.some((ids) => ids.size > 1)) errors.push(`${alignment.id} 单侧混入多个版本`);
    if (sideEditions[0].size && sideEditions[1].size && [...sideEditions[0]][0] === [...sideEditions[1]][0]) errors.push(`${alignment.id} 两侧属于同一版本`);
    for (const id of [...alignment.source_unit_ids, ...alignment.target_unit_ids]) {
      const unit = units.get(id);
      if (!unit) errors.push(`${alignment.id} 引用了不存在的文本单元: ${id}`);
      else if (unit.work_id !== alignment.work_id) errors.push(`${alignment.id} 与文本单元 ${id} 的 work_id 不一致`);
    }
  }
  for (const formula of data.formulas) {
    const edition = editions.get(formula.edition_id);
    if (!edition) errors.push(`${formula.id} 引用了不存在的 edition_id: ${formula.edition_id}`);
    else if (edition.work_id !== formula.work_id) errors.push(`${formula.id} 与版本 work_id 不一致`);
    else if (edition.source_id !== undefined && edition.source_id !== formula.source_id) errors.push(`${formula.id} 与版本 source_id 不一致`);
    const sequences = formula.ingredients.map((item) => item.sequence);
    if (new Set(sequences).size !== sequences.length) errors.push(`${formula.id} 药味 sequence 重复`);
  }
  const linkKeys = new Set();
  for (const [index, link] of data.text_formula_links.entries()) {
    const unit = units.get(link.text_unit_id);
    const formula = formulas.get(link.formula_id);
    if (!unit) errors.push(`text_formula_links[${index}] 引用了不存在的文本单元: ${link.text_unit_id}`);
    if (!formula) errors.push(`text_formula_links[${index}] 引用了不存在的方剂: ${link.formula_id}`);
    if (unit && formula && (unit.work_id !== formula.work_id || unit.edition_id !== formula.edition_id)) errors.push(`text_formula_links[${index}] 两端不属于同一作品版本`);
    const key = `${link.text_unit_id}\u0000${link.formula_id}`;
    if (linkKeys.has(key)) errors.push(`text_formula_links 存在重复链接: ${link.text_unit_id} -> ${link.formula_id}`);
    linkKeys.add(key);
  }

  const expectedCounts = data.manifest?.counts;
  for (const name of collections) {
    if (expectedCounts?.[name] !== data[name].length) errors.push(`manifest.counts.${name} 与实际数量不一致`);
  }
  if (alignments.size !== data.alignments.length) errors.push("alignments ID 不唯一");
  return errors;
}
