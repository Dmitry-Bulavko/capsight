/**
 * Verified Codex platform facts from docs/CODEX-FACTS.md.
 * @see docs/CODEX-FACTS.md
 */

export type FactConfidence = "doc" | "ext" | "spike" | "unknown";

export interface Fact {
  readonly id: string;
  readonly section: string;
  readonly statement: string;
  readonly confidence: FactConfidence;
}

export const FACTS = [
  { id: "XV1", section: "1", statement: "codex --version prints CLI version", confidence: "doc" },
  { id: "XV2", section: "1", statement: "Degraded mode when CLI missing", confidence: "spike" },
  { id: "XV3", section: "1", statement: "Only codex --version in ordinary scan", confidence: "doc" },
  { id: "XR1", section: "2", statement: "Repo root: directory containing .git", confidence: "doc" },
  { id: "XR2", section: "2", statement: "Custom root via project_root_markers", confidence: "doc" },
  { id: "XR3", section: "2", statement: "Layered .codex/config.toml root to cwd", confidence: "doc" },
  {
    id: "XR4",
    section: "9",
    statement: "Ancestor AGENTS.md above scan path included in walk",
    confidence: "doc",
  },
  { id: "XI1", section: "4", statement: "Global AGENTS.override.md else AGENTS.md", confidence: "doc" },
  { id: "XI2", section: "4", statement: "Project walk root to cwd for instructions", confidence: "doc" },
  { id: "XI3", section: "4", statement: "Fallback filenames from config", confidence: "doc" },
  { id: "XI4", section: "4", statement: "Combined instruction size cap", confidence: "doc" },
  { id: "XI5", section: "4", statement: "Merge order root-down; closer wins", confidence: "doc" },
  { id: "XS1", section: "6", statement: "Skills at .agents/skills/<name>/SKILL.md", confidence: "doc" },
  { id: "XS2", section: "6", statement: "User skills path unknown", confidence: "unknown" },
  { id: "XS3", section: "6", statement: "Skill frontmatter open format", confidence: "doc" },
  { id: "XA1", section: "7", statement: "Instruction-based primary agent config", confidence: "doc" },
  { id: "XA3", section: "7", statement: "No separate agents[] unless file-based", confidence: "ext" },
  { id: "XM1", section: "8", statement: "MCP from TOML mcp_servers in user + project", confidence: "doc" },
  { id: "XM2", section: "8", statement: "Transport from command or url", confidence: "doc" },
  { id: "XM3", section: "8", statement: "Probe requires confirmation", confidence: "doc" },
  { id: "XSet1", section: "5", statement: "Parse known TOML keys; unknown as types", confidence: "ext" },
  { id: "XSet3", section: "5", statement: "MCP under mcp_servers.<name>", confidence: "doc" },
  { id: "XSet4", section: "5", statement: "Redact env — key names only", confidence: "doc" },
  { id: "XT1", section: "10", statement: "Untrusted skips project .codex/", confidence: "doc" },
  { id: "XT2", section: "10", statement: "Trust storage format unknown", confidence: "unknown" },
  { id: "XT3", section: "10", statement: "Unreadable trust is unknown not blocked", confidence: "doc" },
] as const satisfies readonly Fact[];

export type FactId = (typeof FACTS)[number]["id"];

export const FACT = Object.fromEntries(FACTS.map((fact) => [fact.id, fact.id])) as Record<
  FactId,
  FactId
>;

const FACT_BY_ID = new Map<string, Fact>(FACTS.map((fact) => [fact.id, fact]));

export function isFactId(value: string): value is FactId {
  return FACT_BY_ID.has(value);
}

function getFact(id: FactId): Fact {
  return FACT_BY_ID.get(id)!;
}

export function factConfidence(id: FactId): FactConfidence {
  return getFact(id).confidence;
}
