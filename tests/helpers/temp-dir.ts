import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

export function createTempDirTracker(prefix: string) {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  return async (): Promise<string> => {
    const created = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    dirs.push(created);
    return created;
  };
}
