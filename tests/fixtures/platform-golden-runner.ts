import fs from "node:fs/promises";
import path from "node:path";

export interface FixtureContextSpec {
  name: string;
  preset: string;
  depth?: number;
  parentMode?: string;
}

export interface FixtureContract {
  env: Record<string, string>;
  version: string;
  contexts: FixtureContextSpec[];
}

export async function loadFixtureContract(fixtureDir: string): Promise<FixtureContract> {
  const [envRaw, versionRaw, contextsRaw] = await Promise.all([
    fs.readFile(path.join(fixtureDir, "env.json"), "utf8"),
    fs.readFile(path.join(fixtureDir, "version.txt"), "utf8"),
    fs.readFile(path.join(fixtureDir, "contexts.json"), "utf8"),
  ]);
  return {
    env: JSON.parse(envRaw) as Record<string, string>,
    version: versionRaw.trim(),
    contexts: JSON.parse(contextsRaw) as FixtureContextSpec[],
  };
}
