import type {
  ClaudeAgent as Agent,
  ClaudeAgentConfiguration as AgentConfiguration,
} from "../model/index.js";

export interface AgentToolFrontmatterChange {
  tools?: string[];
  disallowedTools?: string[];
}

export type ToolFrontmatterField = "tools" | "disallowedTools";

export interface ToolFrontmatterFieldChange {
  field: ToolFrontmatterField;
  before?: string[];
  after?: string[];
}

/** Locale-independent string order (code unit comparison). */
function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function baselineToolEnabled(agent: Agent, toolName: string): boolean {
  const disallowed = agent.configuration.disallowedTools ?? [];
  if (disallowed.includes(toolName)) {
    return false;
  }

  const tools = agent.configuration.tools;
  if (tools !== undefined) {
    return tools.includes(toolName);
  }

  return true;
}

function desiredToolEnabled(
  agent: Agent,
  pendingEdits: Record<string, boolean>,
  toolName: string,
): boolean {
  const override = pendingEdits[toolName];
  if (override !== undefined) {
    return override;
  }
  return baselineToolEnabled(agent, toolName);
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function normalizeOptionalArray(values?: string[]): string[] | undefined {
  if (values === undefined || values.length === 0) {
    return undefined;
  }
  return sortUnique(values);
}

function arraysEqual(left?: string[], right?: string[]): boolean {
  const normalizedLeft = normalizeOptionalArray(left);
  const normalizedRight = normalizeOptionalArray(right);
  if (normalizedLeft === undefined && normalizedRight === undefined) {
    return true;
  }
  if (normalizedLeft === undefined || normalizedRight === undefined) {
    return false;
  }
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

/** Compute new frontmatter tool fields from pending checkbox edits. */
export function computeAgentToolFrontmatter(
  agent: Agent,
  pendingEdits: Record<string, boolean>,
): AgentToolFrontmatterChange {
  const useAllowlist = agent.configuration.tools !== undefined;
  let tools = useAllowlist ? [...agent.configuration.tools!] : undefined;
  let disallowedTools = [...(agent.configuration.disallowedTools ?? [])];

  const pendingToolNames = Object.keys(pendingEdits).sort(compareStrings);

  for (const toolName of pendingToolNames) {
    const desired = desiredToolEnabled(agent, pendingEdits, toolName);

    if (useAllowlist) {
      if (desired) {
        if (!tools!.includes(toolName)) {
          tools!.push(toolName);
        }
        disallowedTools = disallowedTools.filter((entry) => entry !== toolName);
      } else {
        tools = tools!.filter((entry) => entry !== toolName);
      }
    } else if (desired) {
      disallowedTools = disallowedTools.filter((entry) => entry !== toolName);
    } else if (!disallowedTools.includes(toolName)) {
      disallowedTools.push(toolName);
    }
  }

  if (tools !== undefined) {
    const toolSet = new Set(tools);
    disallowedTools = disallowedTools.filter((entry) => !toolSet.has(entry));
  }

  const result: AgentToolFrontmatterChange = {};
  if (tools !== undefined) {
    result.tools = sortUnique(tools);
  }
  const normalizedDisallowed = normalizeOptionalArray(disallowedTools);
  if (normalizedDisallowed !== undefined) {
    result.disallowedTools = normalizedDisallowed;
  }
  return result;
}

export function diffToolFrontmatter(
  before: AgentConfiguration,
  after: AgentToolFrontmatterChange,
): ToolFrontmatterFieldChange[] {
  const changes: ToolFrontmatterFieldChange[] = [];

  if (!arraysEqual(before.tools, after.tools)) {
    changes.push({
      field: "tools",
      before: normalizeOptionalArray(before.tools),
      after: normalizeOptionalArray(after.tools),
    });
  }

  if (!arraysEqual(before.disallowedTools, after.disallowedTools)) {
    changes.push({
      field: "disallowedTools",
      before: normalizeOptionalArray(before.disallowedTools),
      after: normalizeOptionalArray(after.disallowedTools),
    });
  }

  return changes;
}
