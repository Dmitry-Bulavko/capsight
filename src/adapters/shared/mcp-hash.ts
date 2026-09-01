import { createHash } from "node:crypto";
import { sortedObjectKeys } from "./redact.js";

export function computeMcpServerId(configPath: string, name: string): string {
  return createHash("sha256").update(`${configPath}:${name}`).digest("hex").slice(0, 16);
}

/** Key-names-only config hash — env/header values never stored. */
export function computeMcpConfigHash(config: Record<string, unknown>): string {
  const hashInput = {
    command: config.command,
    args: config.args,
    url: config.url,
    type: config.type,
    envKeys: sortedObjectKeys(config.env),
    headerKeys: sortedObjectKeys(config.headers),
  };
  return createHash("sha256").update(JSON.stringify(hashInput)).digest("hex").slice(0, 16);
}
