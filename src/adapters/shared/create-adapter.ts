import path from "node:path";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
} from "../../core/model/index.js";
import type { AdapterScanOptions, PlatformAdapter, PlatformId } from "../platform.js";

export interface CreateAdapterOptions<TSnapshot extends ProjectSnapshot, TWalk = unknown> {
  id: PlatformId;
  detectVersion: () => Promise<TSnapshot["version"]>;
  walkProjectScopes: (projectPath: string) => Promise<TWalk>;
  buildProjectSnapshot: (input: {
    projectPath: string;
    version: TSnapshot["version"];
    walk: TWalk;
  }) => Promise<TSnapshot>;
  resolveEffectiveConfiguration: (
    snapshot: TSnapshot,
    agentId: string,
    context: ExecutionContext,
  ) => Promise<EffectiveConfiguration>;
}

export function createPlatformAdapter<TSnapshot extends ProjectSnapshot, TWalk = unknown>(
  options: CreateAdapterOptions<TSnapshot, TWalk>,
): PlatformAdapter {
  async function scanProject(scanOptions: AdapterScanOptions): Promise<TSnapshot> {
    const projectPath = path.resolve(scanOptions.projectPath);
    const [version, walk] = await Promise.all([
      options.detectVersion(),
      options.walkProjectScopes(projectPath),
    ]);

    return options.buildProjectSnapshot({
      projectPath,
      version,
      walk,
    });
  }

  return {
    id: options.id,
    scan: async (scanOptions) => ({
      snapshot: await scanProject(scanOptions),
      status: "complete",
    }),
    resolve: (snapshot, agentId, context) =>
      options.resolveEffectiveConfiguration(snapshot as TSnapshot, agentId, context),
  };
}
