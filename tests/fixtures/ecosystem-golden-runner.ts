import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearLastScan, scanAndStore } from "../../src/application/scan-store.js";
import { buildEcosystemApiPayload } from "../../src/server/routes/ecosystem.js";
import type { PlatformVersion } from "../../src/core/model/index.js";
import {
  normalizeEcosystemGoldenOutput,
  type NormalizedEcosystemGoldenOutput,
} from "./ecosystem-golden-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ECOSYSTEM_FIXTURES_ROOT = path.join(__dirname, "ecosystem");
export const ECOSYSTEM_MCP_SECRET = "capsight_ec08_mcp_env_secret_do_not_leak";

export interface EcosystemVersionMocks {
  mockDetectClaudeVersion: {
    mockResolvedValue(value: PlatformVersion): void;
  };
  mockDetectCursorVersion: {
    mockResolvedValue(value: PlatformVersion): void;
  };
  mockDetectCodexVersion: {
    mockResolvedValue(value: PlatformVersion): void;
  };
}

interface FixtureContract {
  env: Record<string, string>;
  version: string;
}

export function resolveFixtureEnvPaths(
  fixtureDir: string,
  env: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === "HOME" || key === "USERPROFILE" || key === "CODEX_HOME") {
      resolved[key] = path.isAbsolute(value) ? value : path.resolve(fixtureDir, value);
      continue;
    }
    resolved[key] = value;
  }
  return resolved;
}

export async function loadEcosystemFixtureContract(
  fixtureDir: string,
): Promise<FixtureContract> {
  const [envRaw, versionRaw] = await Promise.all([
    fsPromises.readFile(path.join(fixtureDir, "env.json"), "utf8"),
    fsPromises.readFile(path.join(fixtureDir, "version.txt"), "utf8"),
  ]);

  return {
    env: JSON.parse(envRaw) as Record<string, string>,
    version: versionRaw.trim(),
  };
}

export function applyEcosystemFixtureProcessEnv(
  fixtureDir: string,
  env: Record<string, string>,
): void {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("CLAUDE_") ||
      key.startsWith("CURSOR_") ||
      key.startsWith("CODEX_") ||
      key === "HOME" ||
      key === "USERPROFILE" ||
      key === "CODEX_HOME"
    ) {
      delete process.env[key];
    }
  }

  const resolved = resolveFixtureEnvPaths(fixtureDir, env);
  for (const [key, value] of Object.entries(resolved)) {
    process.env[key] = value;
  }
}

export function mockEcosystemPlatformVersions(
  mocks: EcosystemVersionMocks,
  version: string,
): void {
  const detectedAt = "1970-01-01T00:00:00.000Z";
  mocks.mockDetectClaudeVersion.mockResolvedValue({
    platform: "claude",
    version,
    raw: version,
    detectedAt,
  });
  mocks.mockDetectCursorVersion.mockResolvedValue({
    platform: "cursor",
    version,
    raw: version,
    detectedAt,
  });
  mocks.mockDetectCodexVersion.mockResolvedValue({
    platform: "codex",
    version,
    raw: `codex-cli ${version}`,
    detectedAt,
  });
}

export async function runEcosystemGoldenFixture(
  fixtureName: string,
  mocks: EcosystemVersionMocks,
  options: { fixtureDirOverride?: string; homeDir?: string } = {},
): Promise<{ actual: NormalizedEcosystemGoldenOutput; expected: NormalizedEcosystemGoldenOutput }> {
  const fixtureDir = options.fixtureDirOverride ?? path.join(ECOSYSTEM_FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadEcosystemFixtureContract(fixtureDir);
  const expected = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "expected.json"), "utf8"),
  ) as NormalizedEcosystemGoldenOutput;

  const env = { ...contract.env };
  if (options.homeDir !== undefined) {
    env.HOME = options.homeDir;
    env.USERPROFILE = options.homeDir;
    env.CODEX_HOME = path.join(options.homeDir, ".codex");
  }

  applyEcosystemFixtureProcessEnv(fixtureDir, env);
  mockEcosystemPlatformVersions(mocks, contract.version);

  clearLastScan();
  await scanAndStore(projectRoot);

  const { getEcosystemInventory, getPlatformScans } = await import(
    "../../src/application/scan-store.js"
  );
  const inventory = getEcosystemInventory();
  if (!inventory) {
    throw new Error("scanAndStore did not produce an ecosystem inventory");
  }

  const payload = buildEcosystemApiPayload(inventory, getPlatformScans());
  const actual = normalizeEcosystemGoldenOutput(payload, fixtureDir, projectRoot);
  return { actual, expected };
}

export async function recordEcosystemGoldenFixture(
  fixtureName: string,
  mocks: EcosystemVersionMocks,
): Promise<NormalizedEcosystemGoldenOutput> {
  const fixtureDir = path.join(ECOSYSTEM_FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadEcosystemFixtureContract(fixtureDir);

  applyEcosystemFixtureProcessEnv(fixtureDir, contract.env);
  mockEcosystemPlatformVersions(mocks, contract.version);

  clearLastScan();
  await scanAndStore(projectRoot);

  const { getEcosystemInventory, getPlatformScans } = await import(
    "../../src/application/scan-store.js"
  );
  const inventory = getEcosystemInventory();
  if (!inventory) {
    throw new Error("scanAndStore did not produce an ecosystem inventory");
  }

  const payload = buildEcosystemApiPayload(inventory, getPlatformScans());
  return normalizeEcosystemGoldenOutput(payload, fixtureDir, projectRoot);
}
