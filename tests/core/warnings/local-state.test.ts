import { describe, expect, it } from "vitest";
import {
  LOCAL_STATE_DIR,
  isDirectoryIgnored,
  evaluateDirectoryIgnore,
  localStateWarning,
  localStateWarningMessage,
  parseIgnoreRules,
} from "../../../src/core/warnings/local-state.js";

function ignores(ignoreFile: string, dirPath = LOCAL_STATE_DIR): boolean {
  return isDirectoryIgnored(parseIgnoreRules(ignoreFile), dirPath);
}

describe("parseIgnoreRules() / isDirectoryIgnored()", () => {
  it("matches the realistic ways a project ignores the local state directory", () => {
    expect(ignores(".agent-manager/")).toBe(true);
    expect(ignores(".agent-manager")).toBe(true);
    expect(ignores("/.agent-manager/")).toBe(true);
    expect(ignores("*-manager/")).toBe(true);
    expect(ignores("**/.agent-manager/")).toBe(true);
  });

  it("honours a negation that re-includes the directory after a broader ignore", () => {
    expect(ignores("*-manager/\n!.agent-manager")).toBe(false);
    // Order matters, as in git: the last matching rule wins.
    expect(ignores("!.agent-manager\n*-manager/")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    expect(ignores("# .agent-manager\n\n   \n")).toBe(false);
    expect(ignores("# a comment\n.agent-manager/\n")).toBe(true);
  });

  it("does not match unrelated or partially matching entries", () => {
    expect(ignores("agent-manager-notes/")).toBe(false);
    expect(ignores(".agent-manager-old/")).toBe(false);
    expect(ignores("node_modules/\ndist/")).toBe(false);
  });

  it("anchors patterns that contain a slash to the ignore file's directory", () => {
    // `/.agent-manager` in a parent's .gitignore does not cover a nested project.
    expect(ignores("/.agent-manager/", "sub/.agent-manager")).toBe(false);
    // The unanchored form does.
    expect(ignores(".agent-manager/", "sub/.agent-manager")).toBe(true);
  });

  it("treats an ignored ancestor directory as ignoring everything below it", () => {
    expect(ignores("sub/", "sub/.agent-manager")).toBe(true);
  });

  it("reports 'no opinion' separately from 'not ignored'", () => {
    expect(evaluateDirectoryIgnore(parseIgnoreRules("dist/"), LOCAL_STATE_DIR)).toBeNull();
    expect(evaluateDirectoryIgnore(parseIgnoreRules("!.agent-manager"), LOCAL_STATE_DIR)).toBe(
      false,
    );
    expect(evaluateDirectoryIgnore(parseIgnoreRules(".agent-manager/"), LOCAL_STATE_DIR)).toBe(
      true,
    );
  });
});

describe("localStateWarning()", () => {
  const directory = "/home/dev/project/.agent-manager";

  it("names the directory and the reason", () => {
    const warning = localStateWarning(directory);
    expect(warning.code).toBe("local-state-not-ignored");
    expect(warning.directory).toBe(directory);
    expect(warning.message).toContain(directory);
    expect(warning.message).toContain(".agent-manager/");
    expect(warning.message.toLowerCase()).toContain("machine-specific");
    expect(warning.message.toLowerCase()).toContain("ignore");
  });

  it("says the tool does not edit ignore files itself", () => {
    expect(localStateWarningMessage(directory).toLowerCase()).toContain(
      "never edits your ignore files",
    );
  });

  it("is built only from the directory path, so it cannot carry file contents", () => {
    const message = localStateWarningMessage(directory);
    expect(message).toBe(localStateWarningMessage(directory));
    // Nothing but the caller-supplied path is interpolated.
    expect(localStateWarningMessage("<DIR>").replace("<DIR>", directory)).toBe(message);
  });
});
