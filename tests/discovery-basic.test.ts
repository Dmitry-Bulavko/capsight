import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scan } from "@application/scan.js";
import type { DiscoveredInstruction, DiscoveredMcpServer } from "../src/adapters/claude/discovery/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basicFixture = path.join(__dirname, "fixtures/claude/basic/project");

describe("basic fixture discovery", () => {
  it("builds complete snapshot from basic fixture", async () => {
    const result = await scan({ projectPath: basicFixture });

    expect(result.status).toBe("complete");
    expect(result.snapshot.id).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshot.agents.some((a) => a.name === "backend" && a.status === "active")).toBe(
      true,
    );
    expect(result.snapshot.skills.length).toBeGreaterThanOrEqual(1);
    expect(
      (result.snapshot.instructions as DiscoveredInstruction[]).some(
        (i) => i.type === "CLAUDE.md",
      ),
    ).toBe(true);
    expect(
      (result.snapshot.mcpServers as DiscoveredMcpServer[]).some((s) => s.transport === "stdio"),
    ).toBe(true);
    expect(result.snapshot.settings.length).toBeGreaterThanOrEqual(1);
    expect(result.snapshot.trust.projectPath).toBe(path.resolve(basicFixture));
  });
});
