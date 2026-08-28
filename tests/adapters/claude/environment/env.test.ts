import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPlatformEnvironment } from "../../../../src/adapters/claude/environment/index.js";
import type { SettingsLayer } from "../../../../src/adapters/claude/discovery/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeTempSettings(content: Record<string, unknown>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-env-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "settings.json");
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

function layer(filePath: string, priority = 30): SettingsLayer {
  return { scope: "project", path: filePath, priority };
}

function assertNoSecretValues(
  output: Awaited<ReturnType<typeof buildPlatformEnvironment>>,
  secrets: string[],
): void {
  const serialized = JSON.stringify(output);
  for (const secret of secrets) {
    expect(serialized).not.toContain(secret);
  }
  for (const entry of output.relevant) {
    expect(entry).not.toHaveProperty("value");
    expect(entry.normalizedValue).toBeUndefined();
  }
}

describe("buildPlatformEnvironment", () => {
  it("includes known CLAUDE_* process vars with effect only", async () => {
    const secretDepth = "super-secret-depth-99";
    const secretModel = "sk-ant-api03-very-secret-model-token";
    const result = await buildPlatformEnvironment({
      env: {
        CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: secretDepth,
        CLAUDE_CODE_SUBAGENT_MODEL: secretModel,
        CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
        UNRELATED_VAR: "ignored",
      },
      settingsLayers: [],
    });

    expect(result.relevant).toEqual([
      {
        key: "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS",
        origin: "process",
        effect:
          "All subagents run in foreground; only Filter 1 applies",
      },
      {
        key: "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH",
        origin: "process",
        effect:
          "Sets subagent nesting limit; affects Agent tool availability",
      },
      {
        key: "CLAUDE_CODE_SUBAGENT_MODEL",
        origin: "process",
        effect: "Overrides subagent model (inherit treated as unset)",
      },
    ]);

    assertNoSecretValues(result, [secretDepth, secretModel]);
  });

  it("omits unset known process vars", async () => {
    const result = await buildPlatformEnvironment({
      env: {},
      settingsLayers: [],
    });
    expect(result.relevant).toEqual([]);
  });

  it("merges settings.env keys from settings layers", async () => {
    const apiKey = "sk-live-abc123secret";
    const dbUrl = "postgres://user:pass@host/db";
    const settingsPath = await makeTempSettings({
      env: {
        MY_API_KEY: apiKey,
        DATABASE_URL: dbUrl,
      },
    });

    const result = await buildPlatformEnvironment({
      env: {},
      settingsLayers: [layer(settingsPath)],
    });

    expect(result.relevant).toEqual([
      {
        key: "DATABASE_URL",
        origin: "settings.env",
        effect: "Injected into every session and tool invocation",
      },
      {
        key: "MY_API_KEY",
        origin: "settings.env",
        effect: "Injected into every session and tool invocation",
      },
    ]);

    assertNoSecretValues(result, [apiKey, dbUrl]);
  });

  it("dedupes settings.env keys by highest-priority layer", async () => {
    const highPriority = await makeTempSettings({
      env: { SHARED_KEY: "high-secret" },
    });
    const lowPriority = await makeTempSettings({
      env: { SHARED_KEY: "low-secret", UNIQUE_KEY: "unique-secret" },
    });

    const result = await buildPlatformEnvironment({
      env: {},
      settingsLayers: [
        layer(lowPriority, 10),
        layer(highPriority, 40),
      ],
    });

    const settingsEntries = result.relevant.filter(
      (entry) => entry.origin === "settings.env",
    );
    expect(settingsEntries.map((entry) => entry.key).sort()).toEqual([
      "SHARED_KEY",
      "UNIQUE_KEY",
    ]);
    expect(
      settingsEntries.filter((entry) => entry.key === "SHARED_KEY"),
    ).toHaveLength(1);

    assertNoSecretValues(result, ["high-secret", "low-secret", "unique-secret"]);
  });

  it("combines process env and settings.env entries", async () => {
    const settingsPath = await makeTempSettings({
      env: { CUSTOM_TOKEN: "token-value-should-not-leak" },
    });

    const result = await buildPlatformEnvironment({
      env: {
        CLAUDE_CODE_FORK_SUBAGENT: "1",
      },
      settingsLayers: [layer(settingsPath)],
    });

    expect(result.relevant).toEqual([
      {
        key: "CLAUDE_CODE_FORK_SUBAGENT",
        origin: "process",
        effect:
          "Controls fork mode (1 enables in non-interactive/SDK, 0 disables everywhere)",
      },
      {
        key: "CUSTOM_TOKEN",
        origin: "settings.env",
        effect: "Injected into every session and tool invocation",
      },
    ]);

    assertNoSecretValues(result, ["token-value-should-not-leak"]);
  });
});
