import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDefaultProjectPath } from "../../src/application/default-project-path.js";

describe("getDefaultProjectPath", () => {
  const originalEnv = process.env.CAPSIGHT_PROJECT_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CAPSIGHT_PROJECT_PATH;
    } else {
      process.env.CAPSIGHT_PROJECT_PATH = originalEnv;
    }
  });

  it("falls back to process.cwd() when env is unset", () => {
    delete process.env.CAPSIGHT_PROJECT_PATH;
    expect(getDefaultProjectPath()).toBe(process.cwd());
  });

  it("uses CAPSIGHT_PROJECT_PATH when set", () => {
    process.env.CAPSIGHT_PROJECT_PATH = "D:\\projects\\capsight";
    expect(getDefaultProjectPath()).toBe("D:\\projects\\capsight");
  });

  it("trims whitespace from CAPSIGHT_PROJECT_PATH", () => {
    process.env.CAPSIGHT_PROJECT_PATH = "  /tmp/my-project  ";
    expect(getDefaultProjectPath()).toBe("/tmp/my-project");
  });

  it("falls back to cwd when env is blank", () => {
    process.env.CAPSIGHT_PROJECT_PATH = "   ";
    expect(getDefaultProjectPath()).toBe(process.cwd());
  });
});
