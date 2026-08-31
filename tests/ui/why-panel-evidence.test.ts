import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CapabilityExplain } from "../../src/ui/api.js";
import {
  EvidenceLine,
  matrixConfidenceToTier,
  resolveEvidenceTier,
  WhyPanel,
} from "../../src/ui/components/WhyPanel.js";

function makeExplain(
  overrides: Partial<CapabilityExplain["capability"]> = {},
): CapabilityExplain {
  return {
    agentId: "implementer",
    context: {
      preset: "foreground-subagent",
      isMainSession: false,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 1,
      maxDepth: 3,
    },
    capability: {
      capabilityId: "Read",
      kind: "tool",
      status: "denied",
      enforcement: "enforced",
      sources: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/backend.md",
        },
      ],
      reasons: [
        {
          type: "denied",
          message: "disallowedTools removed this tool from the pool.",
          matrixRef: "agent.disallowedTools",
        },
        {
          type: "context-filter",
          message: "Background filter applied.",
          matrixRef: "T2",
        },
        {
          type: "version",
          message: "Documentation-only tools whitelist.",
          matrixRef: "agent.tools",
        },
      ],
      ...overrides,
    },
  };
}

describe("resolveEvidenceTier", () => {
  it("maps fixture-backed matrix entries to the fixture tier", () => {
    expect(resolveEvidenceTier("agent.disallowedTools")).toBe("fixture");
  });

  it("maps documentation-only matrix entries to the doc tier", () => {
    expect(resolveEvidenceTier("agent.tools")).toBe("doc");
  });

  it("maps cited fact ids to registry confidence", () => {
    expect(resolveEvidenceTier("F2")).toBe("doc");
    expect(resolveEvidenceTier("S1")).toBe("ext");
  });

  it("returns unknown for unregistered refs", () => {
    expect(resolveEvidenceTier("not.a.real.ref")).toBe("unknown");
  });

  it("maps matrix confidence values to UI tiers", () => {
    expect(matrixConfidenceToTier("fixture")).toBe("fixture");
    expect(matrixConfidenceToTier("doc")).toBe("doc");
    expect(matrixConfidenceToTier("runtime-observed")).toBe("spike");
  });
});

describe("WhyPanel evidence lines", () => {
  it("renders confidence tier and matrix ref for each chain entry", () => {
    const html = renderToString(createElement(WhyPanel, { explain: makeExplain(), onClose: () => {} }));

    expect(html).toContain("disallowedTools removed this tool from the pool.");
    expect(html).toContain('class="why-evidence-tier why-evidence-tier-fixture"');
    expect(html).toContain('class="why-evidence-tier why-evidence-tier-doc"');
    expect(html).toContain('class="why-evidence-ref">agent.disallowedTools</code>');
    expect(html).toContain('class="why-evidence-ref">agent.tools</code>');
    expect(html).toContain('class="why-evidence-ref">T2</code>');
  });

  it("visually distinguishes fixture-backed claims from documentation-only claims", () => {
    const html = renderToString(
      createElement(EvidenceLine, { matrixRef: "agent.disallowedTools" }),
    );
    const docHtml = renderToString(createElement(EvidenceLine, { matrixRef: "agent.tools" }));

    expect(html).toContain("why-evidence-tier-fixture");
    expect(docHtml).toContain("why-evidence-tier-doc");
    expect(html).not.toContain("why-evidence-tier-doc");
  });

  it("does not render suite coverage metrics", () => {
    const html = renderToString(createElement(WhyPanel, { explain: makeExplain(), onClose: () => {} }));

    expect(html).not.toMatch(/coverage\s*(report|%|percentage)/i);
    expect(html).not.toMatch(/§11\.4|11\.4/);
    expect(html).not.toMatch(/unverified|matrixReferenced/i);
  });

  it("preserves sources, enforcement, and denied-by sections", () => {
    const html = renderToString(createElement(WhyPanel, { explain: makeExplain(), onClose: () => {} }));

    expect(html).toContain("Source of capability");
    expect(html).toContain(".claude/agents/backend.md");
    expect(html).toContain("Enforced");
    expect(html).toContain("Chain");
  });
});
