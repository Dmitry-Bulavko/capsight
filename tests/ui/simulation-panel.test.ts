import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUNDLE_PATH_STORAGE_KEY,
  loadStoredBundlePath,
  saveStoredBundlePath,
} from "../../src/ui/components/SimulationPanel.js";

describe("SimulationPanel bundle path storage", () => {
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
    expect(loadStoredBundlePath()).toBeNull();
  });

  it("loads a stored bundle path trimmed", () => {
    storage[BUNDLE_PATH_STORAGE_KEY] = "  D:\\policy\\bundle  ";
    expect(loadStoredBundlePath()).toBe("D:\\policy\\bundle");
  });

  it("persists trimmed paths", () => {
    saveStoredBundlePath("  /tmp/bundle  ");
    expect(storage[BUNDLE_PATH_STORAGE_KEY]).toBe("/tmp/bundle");
    expect(loadStoredBundlePath()).toBe("/tmp/bundle");
  });

  it("removes storage entry when path is blank", () => {
    storage[BUNDLE_PATH_STORAGE_KEY] = "/tmp/old";
    saveStoredBundlePath("   ");
    expect(storage[BUNDLE_PATH_STORAGE_KEY]).toBeUndefined();
  });
});
