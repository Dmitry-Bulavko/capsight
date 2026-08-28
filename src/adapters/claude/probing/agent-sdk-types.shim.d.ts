/**
 * Minimal type shim for S0-01 spike.
 * Allows typecheck without installing @anthropic-ai/claude-agent-sdk.
 * Replace with real package types when running the spike manually.
 *
 * @see https://code.claude.com/docs/en/agent-sdk/typescript
 */
declare module "@anthropic-ai/claude-agent-sdk" {
  export interface AgentInfo {
    name: string;
    description: string;
    model?: string;
  }

  export interface McpServerToolInfo {
    name: string;
    description?: string;
    annotations?: {
      readOnly?: boolean;
      destructive?: boolean;
      openWorld?: boolean;
    };
  }

  export interface McpServerStatus {
    name: string;
    status:
      | "connected"
      | "failed"
      | "needs-auth"
      | "pending"
      | "disabled";
    serverInfo?: { name: string; version: string };
    error?: string;
    config?: unknown;
    scope?: string;
    tools?: McpServerToolInfo[];
  }

  export interface ContextUsageToolEntry {
    name: string;
    tokens: number;
    isLoaded?: boolean;
    serverName?: string;
  }

  export interface SDKControlGetContextUsageResponse {
    mcpTools: Array<{
      name: string;
      serverName: string;
      tokens: number;
      isLoaded?: boolean;
    }>;
    deferredBuiltinTools?: Array<{
      name: string;
      tokens: number;
      isLoaded: boolean;
    }>;
    systemTools?: Array<{
      name: string;
      tokens: number;
    }>;
    totalTokens: number;
    maxTokens: number;
    model: string;
  }

  export interface SDKControlInitializeResponse {
    commands: unknown[];
    agents: AgentInfo[];
    models: unknown[];
    account: unknown;
  }

  export interface Query extends AsyncIterable<unknown> {
    initializationResult(): Promise<SDKControlInitializeResponse>;
    mcpServerStatus(): Promise<McpServerStatus[]>;
    getContextUsage(): Promise<SDKControlGetContextUsageResponse>;
    supportedAgents(): Promise<AgentInfo[]>;
    close(): void;
  }

  export interface QueryOptions {
    cwd?: string;
    prompt: string | AsyncIterable<unknown>;
    settingSources?: Array<"user" | "project" | "local" | "managed">;
    strictMcpConfig?: boolean;
    maxTurns?: number;
    permissionMode?: string;
  }

  export function query(options: QueryOptions): Query;
}
