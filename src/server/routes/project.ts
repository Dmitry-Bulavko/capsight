import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { Router, type Response } from "express";
import { getDefaultProjectPath } from "../../application/default-project-path.js";
import {
  buildStatusSummary,
  getLastScan,
  scanAndStore,
} from "../../application/scan-store.js";

export const projectRouter = Router();

export type FolderPickCancelReason = "dismissed" | "unavailable" | "busy" | "timeout";

export type FolderPickResult =
  | { cancelled: false; path: string }
  | { cancelled: true; reason?: FolderPickCancelReason };

const BROWSE_TIMEOUT_MS = 5 * 60 * 1000;
const KILL_ESCALATION_MS = 2000;

let browseActive = false;

/** Test-only: clears the in-flight browse mutex between cases. */
export function resetBrowseInFlightForTests(): void {
  browseActive = false;
}

class BrowseCommandTimeoutError extends Error {
  constructor() {
    super("browse-timeout");
    this.name = "BrowseCommandTimeoutError";
  }
}

function respondServerError(res: Response, err: unknown, clientMessage: string): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[capsight] ${clientMessage}:`, detail);
  res.status(500).json({ error: clientMessage });
}

function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const clearTimers = () => {
      clearTimeout(termTimer);
      clearTimeout(killTimer);
    };

    let termTimer: ReturnType<typeof setTimeout>;
    let killTimer: ReturnType<typeof setTimeout>;

    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }

    termTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, KILL_ESCALATION_MS);
    }, BROWSE_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimers();
      reject(err);
    });

    child.on("close", (code) => {
      clearTimers();
      if (timedOut) {
        reject(new BrowseCommandTimeoutError());
        return;
      }
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function pickNativeFolderInternal(): Promise<FolderPickResult> {
  const os = platform();

  try {
    if (os === "win32") {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
        "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
        "  Write-Output $dialog.SelectedPath",
        "}",
      ].join("\n");
      const { stdout } = await runCommand("powershell", ["-NoProfile", "-Command", script]);
      const pickedPath = stdout.trim();
      return pickedPath
        ? { cancelled: false, path: pickedPath }
        : { cancelled: true, reason: "dismissed" };
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
      const pickedPath = stdout.trim();
      return pickedPath
        ? { cancelled: false, path: pickedPath }
        : { cancelled: true, reason: "dismissed" };
    }

    const { stdout, code, stderr } = await runCommand("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select project folder",
    ]);
    if (code !== 0) {
      return { cancelled: true, reason: stderr.trim() ? "unavailable" : "dismissed" };
    }
    const pickedPath = stdout.trim();
    return pickedPath
      ? { cancelled: false, path: pickedPath }
      : { cancelled: true, reason: "dismissed" };
  } catch (err) {
    if (err instanceof BrowseCommandTimeoutError) {
      return { cancelled: true, reason: "timeout" };
    }
    return { cancelled: true, reason: "unavailable" };
  }
}

export async function pickNativeFolder(): Promise<FolderPickResult> {
  if (browseActive) {
    return { cancelled: true, reason: "busy" };
  }

  browseActive = true;
  try {
    return await pickNativeFolderInternal();
  } finally {
    browseActive = false;
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
  try {
    const result = await pickNativeFolder();
    res.json(result);
  } catch (err) {
    respondServerError(res, err, "Folder browse failed");
  }
});

projectRouter.post("/scan", async (req, res) => {
  try {
    const projectPath = resolveScanPath(req.body?.projectPath);
    const result = await scanAndStore(projectPath);
    res.json(result);
  } catch (err) {
    respondServerError(res, err, "Project scan failed");
  }
});

projectRouter.get("/", (_req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }
  res.json(buildStatusSummary(lastScan));
});
