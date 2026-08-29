import { spawn } from "node:child_process";
import { platform } from "node:os";
import { Router } from "express";
import { getDefaultProjectPath } from "../../application/default-project-path.js";
import {
  buildStatusSummary,
  getLastScan,
  scanAndStore,
} from "../../application/scan-store.js";

export const projectRouter = Router();

export type FolderPickResult = { cancelled: true } | { cancelled: false; path: string };

function runCommand(command: string, args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, code: code ?? 1 });
    });
  });
}

export async function pickNativeFolder(): Promise<FolderPickResult> {
  const os = platform();

  if (os === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  Write-Output $dialog.SelectedPath",
      "}",
    ].join("; ");
    const { stdout } = await runCommand("powershell", ["-NoProfile", "-Command", script]);
    const path = stdout.trim();
    return path ? { cancelled: false, path } : { cancelled: true };
  }

  if (os === "darwin") {
    const script = [
      "try",
      '  POSIX path of (choose folder with prompt "Select project folder")',
      "on error number -128",
      '  return ""',
      "end try",
    ].join("\n");
    const { stdout } = await runCommand("osascript", ["-e", script]);
    const path = stdout.trim();
    return path ? { cancelled: false, path } : { cancelled: true };
  }

  try {
    const { stdout, code } = await runCommand("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select project folder",
    ]);
    if (code !== 0) {
      return { cancelled: true };
    }
    const path = stdout.trim();
    return path ? { cancelled: false, path } : { cancelled: true };
  } catch {
    return { cancelled: true };
  }
}

function resolveScanPath(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return getDefaultProjectPath();
}

projectRouter.get("/config", (_req, res) => {
  res.json({ defaultProjectPath: getDefaultProjectPath() });
});

projectRouter.post("/browse", async (_req, res) => {
  const result = await pickNativeFolder();
  res.json(result);
});

projectRouter.post("/scan", async (req, res) => {
  const projectPath = resolveScanPath(req.body?.projectPath);
  const result = await scanAndStore(projectPath);
  res.json(result);
});

projectRouter.get("/", (_req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }
  res.json(buildStatusSummary(lastScan));
});
