/**
 * Local-state warning vocabulary and a small ignore-rule matcher.
 *
 * Pure: no filesystem access, no platform vocabulary. The tool stores its own
 * machine-specific data under `.agent-manager/` inside the inspected project
 * (SPEC §12.3) and recommends ignoring it in version control. The tool never
 * edits the project's ignore files itself (§13 invariant 6).
 */

/** Directory the tool writes its local state into, relative to the project root. */
export const LOCAL_STATE_DIR = ".agent-manager";

export interface LocalStateWarning {
  code: "local-state-not-ignored";
  /** Absolute path of the directory the tool is about to write into. */
  directory: string;
  message: string;
}

/**
 * Warning text. Names the directory and the reason; never quotes file contents
 * (§0.1.8) — backups are byte copies of the user's configuration files.
 */
export function localStateWarningMessage(directory: string): string {
  return (
    `${directory} now holds this tool's local state. Add \`${LOCAL_STATE_DIR}/\` to your ` +
    "ignore rules before committing: the data is machine-specific and may contain " +
    "byte-for-byte copies of your configuration files, including any secrets in them. " +
    "This tool never edits your ignore files itself."
  );
}

export function localStateWarning(directory: string): LocalStateWarning {
  return {
    code: "local-state-not-ignored",
    directory,
    message: localStateWarningMessage(directory),
  };
}

export interface IgnoreRule {
  /** Regex matching a path relative to the directory the rule file lives in. */
  matcher: RegExp;
  negated: boolean;
  dirOnly: boolean;
}

function patternToRegExpSource(pattern: string): string {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return source;
}

/**
 * Parse one ignore file. Supports the subset of gitignore syntax that can cover
 * a top-level directory: comments, blank lines, `!` negation, trailing `/`
 * (directory-only), leading `/` (anchored) and `*` / `**` / `?` globs.
 * Character classes and escaped `#`/`!` are not interpreted.
 */
export function parseIgnoreRules(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    let pattern = line;
    let negated = false;
    if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1);
    }

    let dirOnly = false;
    if (pattern.endsWith("/")) {
      dirOnly = true;
      pattern = pattern.slice(0, -1);
    }
    if (pattern === "") {
      continue;
    }

    // A slash anywhere but at the end anchors the pattern to the rule file's directory.
    const anchored = pattern.includes("/");
    if (pattern.startsWith("/")) {
      pattern = pattern.slice(1);
    }

    const source = patternToRegExpSource(pattern);
    rules.push({
      matcher: new RegExp(`^${anchored ? "" : "(?:.*/)?"}${source}$`),
      negated,
      dirOnly,
    });
  }
  return rules;
}

/**
 * Decide `relativeDirPath` (a directory, POSIX separators, relative to the rule
 * file's directory) against one file's rules. An ignored ancestor ignores
 * everything below it, so every path prefix is tested. Later rules win, as in
 * git. Returns null when no rule in this file has an opinion, which lets the
 * caller keep the decision of a less specific ignore file.
 */
export function evaluateDirectoryIgnore(
  rules: IgnoreRule[],
  relativeDirPath: string,
): boolean | null {
  const segments = relativeDirPath.split("/").filter((segment) => segment !== "");
  if (segments.length === 0) {
    return null;
  }

  const prefixes = segments.map((_segment, index) => segments.slice(0, index + 1).join("/"));

  let decision: boolean | null = null;
  for (const rule of rules) {
    // Every prefix is a directory, so `dirOnly` never excludes a match here.
    if (prefixes.some((prefix) => rule.matcher.test(prefix))) {
      decision = !rule.negated;
    }
  }
  return decision;
}

/** As `evaluateDirectoryIgnore`, with "no rule matched" reported as not ignored. */
export function isDirectoryIgnored(rules: IgnoreRule[], relativeDirPath: string): boolean {
  return evaluateDirectoryIgnore(rules, relativeDirPath) === true;
}
