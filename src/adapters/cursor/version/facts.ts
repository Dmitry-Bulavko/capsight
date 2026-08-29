/**
 * Verified Cursor platform facts from docs/CURSOR-FACTS.md.
 * @see docs/CURSOR-FACTS.md
 */

export type FactConfidence = "doc" | "ext" | "spike" | "unknown";

export interface Fact {
  readonly id: string;
  readonly section: string;
  readonly statement: string;
  readonly confidence: FactConfidence;
}

export const FACTS = [
  { id: "CV1", section: "1", statement: "cursor --version prints semver", confidence: "spike" },
  { id: "CV2", section: "1", statement: "Degraded mode when CLI missing", confidence: "doc" },
  { id: "CV3", section: "1", statement: "IDE-only installs may lack CLI", confidence: "ext" },
  { id: "CW1", section: "3", statement: "Repo root: directory containing .git", confidence: "doc" },
  { id: "CW2", section: "3", statement: "Walk upward collecting .cursor/ metadata", confidence: "ext" },
  { id: "CW3", section: "3", statement: "Nested AGENTS.md applies in subtree", confidence: "doc" },
  { id: "CW4", section: "3", statement: "Same-name collision rules unknown", confidence: "unknown" },
  { id: "CA1", section: "4", statement: "Agent files under .cursor/agents/**/*.md", confidence: "doc" },
  { id: "CA2", section: "4", statement: "Invalid agents missing name/description", confidence: "doc" },
  { id: "CA3", section: "4", statement: "Same-directory name collision ambiguous", confidence: "ext" },
  { id: "CA4", section: "4", statement: "Subagent tool pool semantics unknown", confidence: "unknown" },
  { id: "CS1", section: "5", statement: "Skills at .cursor/skills/<name>/SKILL.md", confidence: "doc" },
  { id: "CS2", section: "5", statement: "Skill invocation flags unknown", confidence: "unknown" },
  { id: "CS3", section: "5", statement: "Commands distinct from skills", confidence: "doc" },
  { id: "CR1", section: "6", statement: "Rule frontmatter: description, alwaysApply, globs", confidence: "doc" },
  { id: "CR2", section: "6", statement: "alwaysApply/globs control application mode", confidence: "doc" },
  { id: "CR3", section: "6", statement: "Map rules to instructions[] type rule", confidence: "ext" },
  { id: "CM1", section: "7", statement: "Project MCP at .cursor/mcp.json", confidence: "doc" },
  { id: "CM2", section: "7", statement: "User MCP at ~/.cursor/mcp.json", confidence: "spike" },
  { id: "CM3", section: "7", statement: "Redact env values — key names only", confidence: "doc" },
  { id: "CM4", section: "7", statement: "Probe requires explicit confirmation", confidence: "doc" },
  { id: "CSet1", section: "8", statement: "Settings in app user data directory", confidence: "spike" },
  { id: "CSet2", section: "8", statement: "Project-level settings path unknown", confidence: "unknown" },
  { id: "CSet3", section: "8", statement: "Discover readable JSON where paths stable", confidence: "ext" },
  { id: "CT1", section: "9", statement: "Cursor trust model unknown", confidence: "unknown" },
  { id: "CT2", section: "9", statement: "Do not write to scanned project .cursor/**", confidence: "doc" },
] as const satisfies readonly Fact[];

export type FactId = (typeof FACTS)[number]["id"];

export const FACT = Object.fromEntries(FACTS.map((fact) => [fact.id, fact.id])) as Record<
  FactId,
  FactId
>;
