export function splitPostgresStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag: string | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (!single && !double && !dollarTag && char === "-" && next === "-") {
      current += char + next;
      i += 1;
      lineComment = true;
      continue;
    }
    if (!single && !double && !dollarTag && char === "/" && next === "*") {
      current += char + next;
      i += 1;
      blockComment = true;
      continue;
    }
    if (!single && !double && char === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        const tag = match[0];
        if (!dollarTag) dollarTag = tag;
        else if (dollarTag === tag) dollarTag = null;
        current += tag;
        i += tag.length - 1;
        continue;
      }
    }
    if (!double && !dollarTag && char === "'" && sql[i - 1] !== "\\") single = !single;
    if (!single && !dollarTag && char === "\"" && sql[i - 1] !== "\\") double = !double;
    if (!single && !double && !dollarTag && char === ";") {
      const statement = current.trim();
      if (statement && !/^(BEGIN|COMMIT)$/i.test(statement)) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }
  const trailing = current.trim();
  if (trailing && !/^(BEGIN|COMMIT)$/i.test(trailing)) statements.push(trailing);
  return statements;
}
