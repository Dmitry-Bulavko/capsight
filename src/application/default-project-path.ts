export function getDefaultProjectPath(): string {
  const envPath = process.env.CAPSIGHT_PROJECT_PATH?.trim();
  if (envPath) {
    return envPath;
  }
  return process.cwd();
}
