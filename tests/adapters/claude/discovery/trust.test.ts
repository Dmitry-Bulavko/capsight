import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTrustState } from "../../../../src/adapters/claude/discovery/trust.js";
import {
  captureHomeEnv,
  restoreIsolatedHome,
  setIsolatedHome,
} from "../../../helpers/isolated-home.js";

const originalHomeEnv = captureHomeEnv();
const tempDirs: string[] = [];

async function makeHome(claudeJson?: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-trust-"));
  tempDirs.push(dir);
  if (claudeJson !== undefined) {
    await fs.writeFile(path.join(dir, ".claude.json"), claudeJson, "utf8");
  }
  setIsolatedHome(dir);
  return dir;
}

afterEach(async () => {
  restoreIsolatedHome(originalHomeEnv);
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe("readTrustState", () => {
  it("reports accepted trust for a recorded project", async () => {
    const projectPath = path.resolve("/workspace/project");
    await makeHome(
      JSON.stringify({
        projects: { [projectPath]: { hasTrustDialogAccepted: true } },
      }),
    );

    await expect(readTrustState(projectPath)).resolves.toMatchObject({
      accepted: true,
      projectPath,
    });
  });

  it("reports not-accepted when the project has no trust record", async () => {
    await makeHome(JSON.stringify({ projects: {} }));

    await expect(readTrustState("/workspace/project")).resolves.toMatchObject({
      accepted: false,
    });
  });

  it("reports not-accepted when ~/.claude.json does not exist", async () => {
    await makeHome();

    await expect(readTrustState("/workspace/project")).resolves.toMatchObject({
      accepted: false,
    });
  });

  it("reports unknown when ~/.claude.json is malformed", async () => {
    await makeHome("{ not json");

    const result = await readTrustState("/workspace/project");

    expect(result.accepted).toBe("unknown");
    expect(result.unknownReason).toContain("malformed JSON");
  });

  it("reports unknown when ~/.claude.json cannot be read", async () => {
    const home = await makeHome();
    // A directory in place of the file yields a read error that is not ENOENT,
    // deterministically even when the test runs as root.
    await fs.mkdir(path.join(home, ".claude.json"));

    const result = await readTrustState("/workspace/project");

    expect(result.accepted).toBe("unknown");
    expect(result.unknownReason).toContain("Could not read");
  });
});
