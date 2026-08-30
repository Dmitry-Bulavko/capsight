import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import type { OverlapRelation } from "../../src/core/model/ecosystem.js";
import type { EcosystemResourceDetail } from "../../src/server/routes/ecosystem.js";
import { ResourceDetailPanel } from "../../src/ui/components/ResourceDetailPanel.js";

function makeDetail(
  overrides: Partial<EcosystemResourceDetail> = {},
): EcosystemResourceDetail {
  return {
    resource: {
      id: "claude:skill:fixture",
      kind: "skill",
      platform: "claude",
      scope: "project",
      resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      name: "fixture-skill",
      path: "/repo/.claude/skills/fixture/SKILL.md",
      compat: {
        claude: {
          support: "supported",
          enforcement: "enforced",
          matrixRef: "compat.claude.skill-directory",
          reason: "Claude Code discovers skills from skill directories.",
        },
        cursor: { support: "unknown", enforcement: "unknown" },
        codex: { support: "unknown", enforcement: "unknown" },
      },
    },
    relatedFiles: [{ path: "/repo/.claude/skills/fixture/SKILL.md", role: "primary" }],
    relatedFolders: [{ path: "/repo/.claude/skills/fixture", role: "skill-directory" }],
    overlaps: [],
    ...overrides,
  };
}

const overlap: OverlapRelation = {
  ids: ["claude:skill:fixture", "cursor:skill:fixture"],
  collision: {
    candidates: [],
    rule: "A1",
    effective: {
      platform: "claude",
      scope: "project",
      path: "/repo/.claude/skills/fixture/SKILL.md",
    },
    matrixRef: "compat.overlap.skill",
  },
};

describe("ResourceDetailPanel", () => {
  it("renders identity, compat, paths and collision sections", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail({ overlaps: [overlap] }),
        content: {
          frontmatter: { name: "fixture-skill", description: "A fixture" },
          body: "# Body heading\n\nParagraph.",
          truncated: false,
        },
        onClose: () => {},
      }),
    );

    expect(html).toContain("fixture-skill");
    expect(html).toContain("Skill");
    expect(html).toContain("claude");
    expect(html).toContain("project");
    expect(html).toContain(RESOURCE_CLASS.SKILL_DIRECTORY);
    expect(html).toContain("Compatibility");
    expect(html).toContain("compat.claude.skill-directory");
    expect(html).toContain("Source paths");
    expect(html).toContain("/repo/.claude/skills/fixture/SKILL.md");
    expect(html).toContain("skill-directory");
    expect(html).toContain("Collisions");
    expect(html).toContain("cursor:skill:fixture");
    expect(html).toContain("resource-detail-accordion");
    expect(html).toContain("Metadata");
    expect(html).toContain("resource-detail-markdown-scroll");
    expect(html).toContain('aria-label="Close resource details"');
  });

  it("shows frontmatter as fields and not in the rendered body header area", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail(),
        content: {
          frontmatter: { name: "fixture-skill", description: "From frontmatter" },
          body: "# Visible body\n\nNo frontmatter keys here.",
          truncated: false,
        },
        onClose: () => {},
      }),
    );

    expect(html).toContain("Frontmatter");
    expect(html).toContain("From frontmatter");
    expect(html).toContain("Visible body");
    expect(html).not.toContain("name: fixture-skill");
  });

  it("states truncated content explicitly", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail(),
        content: {
          frontmatter: {},
          body: "Partial body",
          truncated: true,
        },
        onClose: () => {},
      }),
    );

    expect(html).toContain("Body truncated");
  });

  it("states unreadable content via contentError", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail(),
        content: null,
        contentError: "Resource file is unreadable",
        onClose: () => {},
      }),
    );

    expect(html).toContain("Resource file is unreadable");
  });

  it("shows MCP redacted model and no content section", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail({
          resource: {
            ...makeDetail().resource,
            id: "claude:mcp_server:github",
            kind: "mcp_server",
            name: "github",
            resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
            path: "/repo/.mcp.json",
          },
          relatedFiles: [{ path: "/repo/.mcp.json", role: "config-file" }],
          relatedFolders: [{ path: "/repo", role: "config-directory" }],
          snapshot: {
            name: "github",
            transport: "stdio",
            commandName: "npx",
            envKeys: ["GITHUB_TOKEN"],
            headerKeys: ["Authorization"],
            status: "configured",
            definitionKind: "config-file",
          },
        }),
        content: null,
        contentUnavailable: true,
        onClose: () => {},
      }),
    );

    expect(html).toContain("Redacted model");
    expect(html).toContain("Configuration values are never read");
    expect(html).toContain("stdio");
    expect(html).toContain("npx");
    expect(html).toContain("GITHUB_TOKEN");
    expect(html).toContain("Authorization");
    expect(html).not.toContain("<h3>Content</h3>");
  });

  it("does not render script tags from fixture skill body content", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: makeDetail(),
        content: {
          frontmatter: {},
          body: `<script>alert("xss")</script>\n\n# Safe heading`,
          truncated: false,
        },
        onClose: () => {},
      }),
    );

    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("Safe heading");
  });
});
