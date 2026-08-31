/**
 * Top-level keys recognized in Codex config.toml (XSet1).
 * @see docs/CODEX-FACTS.md §3, §5
 */
export const KNOWN_TOP_LEVEL_CONFIG_KEYS = new Set([
  "approval_policy",
  "mcp_servers",
  "model_provider",
  "notify",
  "openai_base_url",
  "otel",
  "profiles",
  "project_doc_fallback_filenames",
  "project_doc_max_bytes",
  "project_root_markers",
]);
