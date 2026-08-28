import { describe, expect, it } from "vitest";
import { ADAPTER_ID } from "../src/adapters/claude/adapter.js";

describe("scaffold", () => {
  it("loads Claude adapter", () => {
    expect(ADAPTER_ID).toBe("claude");
  });
});
