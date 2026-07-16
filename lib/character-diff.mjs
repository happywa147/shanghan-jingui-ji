export function characterDiff(source, target) {
  const a = [...source];
  const b = [...target];
  const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      rows[i][j] = a[i] === b[j]
        ? rows[i + 1][j + 1] + 1
        : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const operations = [];
  const append = (type, text) => {
    const last = operations.at(-1);
    if (last?.type === type) last.text += text;
    else operations.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      append("equal", a[i++]);
      j++;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      append("delete", a[i++]);
    } else {
      append("insert", b[j++]);
    }
  }
  while (i < a.length) append("delete", a[i++]);
  while (j < b.length) append("insert", b[j++]);
  return operations;
}
