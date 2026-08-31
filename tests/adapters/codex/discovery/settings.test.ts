import { describe, expect, it } from "vitest";
import { redactUnknownFields } from "../../../../src/adapters/codex/discovery/redact.js";
import { KNOWN_TOP_LEVEL_CONFIG_KEYS } from "../../../../src/adapters/codex/discovery/config-keys.js";

describe("codex settings unknown fields (XSet1)", () => {
  it("records unknown top-level keys as types only", () => {
    expect(
      redactUnknownFields(
        {
          mcp_servers: {},
          experimental_feature_enabled: true,
          custom_router_url: "https://example.com/secret",
        },
        KNOWN_TOP_LEVEL_CONFIG_KEYS,
      ),
    ).toEqual({
      experimental_feature_enabled: "boolean",
      custom_router_url: "string",
    });
  });
});
