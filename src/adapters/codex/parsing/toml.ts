/**
 * Minimal TOML parser for Codex config files.
 * Handles tables, dotted headers, strings, numbers, booleans, arrays, inline tables.
 * @see docs/CODEX-FACTS.md XSet1, XSet3
 */

type TomlPrimitive = string | number | boolean;
type TomlValue = TomlPrimitive | TomlValue[] | { [key: string]: TomlValue };

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

function parseStringLiteral(raw: string): string {
  const quote = raw[0];
  if (quote !== '"' && quote !== "'") {
    return raw;
  }
  let result = "";
  for (let index = 1; index < raw.length - 1; index += 1) {
    const char = raw[index]!;
    if (char === "\\" && quote === '"') {
      index += 1;
      const escaped = raw[index];
      if (escaped === "n") {
        result += "\n";
      } else if (escaped === "t") {
        result += "\t";
      } else if (escaped !== undefined) {
        result += escaped;
      }
    } else {
      result += char;
    }
  }
  return result;
}

function parseScalar(raw: string): TomlValue {
  const trimmed = raw.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return parseStringLiteral(trimmed);
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  return trimmed;
}

function parseInlineTable(raw: string): Record<string, TomlValue> {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) {
    return {};
  }
  const entries = splitTopLevel(inner, ",");
  const result: Record<string, TomlValue> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = entry.slice(0, eqIndex).trim();
    const valueRaw = entry.slice(eqIndex + 1).trim();
    result[key] = parseValueToken(valueRaw);
  }
  return result;
}

function parseArray(raw: string): TomlValue[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return splitTopLevel(inner, ",").map((part) => parseValueToken(part.trim()));
}

function parseValueToken(raw: string): TomlValue {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineTable(trimmed);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseArray(trimmed);
  }
  return parseScalar(trimmed);
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depthBrace = 0;
  let depthBracket = 0;
  let inSingle = false;
  let inDouble = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (!inSingle && !inDouble) {
      if (char === "{") {
        depthBrace += 1;
      } else if (char === "}") {
        depthBrace -= 1;
      } else if (char === "[") {
        depthBracket += 1;
      } else if (char === "]") {
        depthBracket -= 1;
      } else if (char === delimiter && depthBrace === 0 && depthBracket === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function setNestedTable(root: Record<string, TomlValue>, path: string[]): Record<string, TomlValue> {
  let current = root;
  for (const segment of path) {
    const existing = current[segment];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      current = existing as Record<string, TomlValue>;
    } else {
      const next: Record<string, TomlValue> = {};
      current[segment] = next;
      current = next;
    }
  }
  return current;
}

function parseTableHeader(line: string): string[] | null {
  const match = line.match(/^\[([^\]]+)\]$/);
  if (!match) {
    return null;
  }
  return match[1]!.split(".").map((part) => part.trim()).filter(Boolean);
}

export function parseToml(content: string): Record<string, TomlValue> {
  const root: Record<string, TomlValue> = {};
  let currentTable = root;
  const lines = content.split(/\r?\n/);
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const rawLine = lines[lineIndex]!;
    lineIndex += 1;
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }

    const tablePath = parseTableHeader(line);
    if (tablePath) {
      currentTable = setNestedTable(root, tablePath);
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let valueRaw = line.slice(eqIndex + 1).trim();

    if (valueRaw.startsWith("[") && !valueRaw.endsWith("]")) {
      const parts = [valueRaw];
      while (lineIndex < lines.length) {
        const nextRaw = lines[lineIndex]!;
        lineIndex += 1;
        const nextLine = stripComment(nextRaw).trim();
        parts.push(nextLine);
        if (nextLine.endsWith("]")) {
          break;
        }
      }
      valueRaw = parts.join("\n");
    }

    currentTable[key] = parseValueToken(valueRaw);
  }

  return root;
}

export function getTomlTable(
  parsed: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = parsed[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function getTomlStringArray(
  parsed: Record<string, TomlValue>,
  key: string,
): string[] | undefined {
  const value = parsed[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map(String);
}
