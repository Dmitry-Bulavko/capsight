import { parse as parseYaml } from "yaml";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export type FrontmatterParseResult =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; reason: "bad-yaml"; message: string };

export function parseFrontmatter(content: string): FrontmatterParseResult {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { ok: true, data: {}, body: content };
  }

  try {
    const parsed = parseYaml(match[1]);
    const data =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const body = content.slice(match[0].length).trimStart();
    return { ok: true, data, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "bad-yaml", message };
  }
}

export function getStringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}
