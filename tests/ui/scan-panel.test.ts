import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatProjectFolderLabel,
  loadStoredPlatform,
  loadStoredProjectPath,
  PLATFORM_STORAGE_KEY,
  PROJECT_PATH_STORAGE_KEY,
  saveStoredPlatform,
  saveStoredProjectPath,
} from "../../src/ui/components/ScanPanel.js";

describe("ScanPanel project path storage", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredProjectPath()).toBeNull();
  });

  it("loads a stored project path trimmed", () => {
    storage[PROJECT_PATH_STORAGE_KEY] = "  D:\\projects\\demo  ";
    expect(loadStoredProjectPath()).toBe("D:\\projects\\demo");
  });

  it("ignores blank stored values", () => {
    storage[PROJECT_PATH_STORAGE_KEY] = "   ";
    expect(loadStoredProjectPath()).toBeNull();
  });

  it("persists trimmed paths", () => {
    saveStoredProjectPath("  /tmp/project  ");
    expect(storage[PROJECT_PATH_STORAGE_KEY]).toBe("/tmp/project");
    expect(loadStoredProjectPath()).toBe("/tmp/project");
  });

  it("removes storage entry when path is blank", () => {
    storage[PROJECT_PATH_STORAGE_KEY] = "/tmp/old";
    saveStoredProjectPath("   ");
    expect(storage[PROJECT_PATH_STORAGE_KEY]).toBeUndefined();
  });
});

describe("ScanPanel platform storage", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists platform selection without a project path", () => {
    saveStoredPlatform("cursor");
    expect(storage[PLATFORM_STORAGE_KEY]).toBe("cursor");
    expect(loadStoredPlatform()).toBe("cursor");
  });
});

describe("formatProjectFolderLabel", () => {
  it("returns empty string when path is empty", () => {
    expect(formatProjectFolderLabel("")).toBe("");
  });

  it("shows folder basename only", () => {
    expect(formatProjectFolderLabel("D:\\projects\\backbone")).toBe("backbone");
    expect(formatProjectFolderLabel("/home/dev/my-app/")).toBe("my-app");
  });

  it("shortens very long folder names", () => {
    const longName = "a-very-long-project-folder-name";
    expect(formatProjectFolderLabel(`C:\\dev\\${longName}`, 20)).toBe("a-very-long-project…");
  });
});
