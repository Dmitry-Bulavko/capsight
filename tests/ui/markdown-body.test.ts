import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  MarkdownBody,
  renderMarkdownHtml,
  sanitizeMarkdownHtml,
} from "../../src/ui/components/MarkdownBody.js";

describe("renderMarkdownHtml", () => {
  it("renders headings, lists, tables and code blocks", () => {
    const markdown = `# Title

## Section

- one
- two

| Col A | Col B |
| --- | --- |
| a | b |

\`\`\`ts
const x = 1;
\`\`\`
`;

    const html = renderMarkdownHtml(markdown);

    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("<h2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("<pre>");
    expect(html).toContain("language-ts");
  });

  it("strips script tags from fixture skill markdown", () => {
    const markdown = `# Skill

<script>alert("xss")</script>

Use safely.
`;

    const html = renderMarkdownHtml(markdown);

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('alert("xss")');
    expect(html).toContain("Use safely.");
  });

  it("sanitizes javascript: URLs in links", () => {
    const markdown = `[click me](javascript:alert(1))`;
    const html = renderMarkdownHtml(markdown);

    expect(html).not.toContain("javascript:");
  });
});

describe("sanitizeMarkdownHtml", () => {
  it("does not allow script nodes to reach a DOM tree", () => {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    const raw = '<p>Hello</p><script>document.body.dataset.pwned="1"</script>';
    const sanitized = sanitizeMarkdownHtml(raw);

    dom.window.document.body.innerHTML = sanitized;

    expect(dom.window.document.querySelector("script")).toBeNull();
    expect(dom.window.document.body.textContent).toContain("Hello");
    expect(dom.window.document.body.dataset.pwned).toBeUndefined();
  });
});

describe("MarkdownBody", () => {
  it("renders sanitized markdown in the component output", () => {
    const html = renderToString(
      createElement(MarkdownBody, {
        markdown: `<script>evil()</script>\n\n# Heading\n\n- item`,
      }),
    );

    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('data-testid="markdown-body"');
    expect(html).toContain("Heading");
    expect(html).toContain("<ul>");
  });

  it("shows an empty-state message for blank markdown", () => {
    const html = renderToString(createElement(MarkdownBody, { markdown: "   " }));
    expect(html).toContain("No body content.");
  });
});
