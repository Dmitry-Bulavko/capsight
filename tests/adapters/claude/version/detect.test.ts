import { describe, expect, it, vi } from "vitest";
import {
  detectClaudeVersion,
  type CommandRunner,
} from "../../../../src/adapters/claude/version/detect.js";

function mockRunner(
  impl: (command: string, timeoutMs: number) => Promise<{ stdout: string; stderr: string }>,
): CommandRunner {
  return { run: impl };
}

describe("detectClaudeVersion", () => {
  it("parses semver from successful claude --version output", async () => {
    const result = await detectClaudeVersion({
      commandRunner: mockRunner(async (command) => {
        expect(command).toBe("claude --version");
        return { stdout: "2.1.5 (abc123def)", stderr: "" };
      }),
    });

    expect(result.platform).toBe("claude");
    expect(result.version).toBe("2.1.5");
    expect(result.raw).toBe("2.1.5 (abc123def)");
    expect(result.detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns unknown when CLI is not found", async () => {
    const result = await detectClaudeVersion({
      commandRunner: mockRunner(async () => {
        const error = new Error("spawn claude ENOENT");
        throw error;
      }),
    });

    expect(result.platform).toBe("claude");
    expect(result.version).toBe("unknown");
    expect(result.raw).toContain("ENOENT");
  });

  it("returns unknown on non-zero exit", async () => {
    const result = await detectClaudeVersion({
      commandRunner: mockRunner(async () => {
        const error = new Error("Command failed: claude --version");
        throw error;
      }),
    });

    expect(result.platform).toBe("claude");
    expect(result.version).toBe("unknown");
    expect(result.raw).toContain("Command failed");
  });

  it("returns unknown when output has no parseable semver", async () => {
    const result = await detectClaudeVersion({
      commandRunner: mockRunner(async () => ({
        stdout: "claude",
        stderr: "",
      })),
    });

    expect(result.version).toBe("unknown");
    expect(result.raw).toBe("claude");
  });

  it("returns unknown when output is empty", async () => {
    const result = await detectClaudeVersion({
      commandRunner: mockRunner(async () => ({ stdout: "", stderr: "" })),
    });

    expect(result.version).toBe("unknown");
    expect(result.raw).toBe("");
  });

  it("passes timeout to the command runner", async () => {
    const run = vi.fn(async () => ({ stdout: "1.0.0", stderr: "" }));

    await detectClaudeVersion({
      commandRunner: { run },
      timeoutMs: 2500,
    });

    expect(run).toHaveBeenCalledWith("claude --version", 2500);
  });
});
