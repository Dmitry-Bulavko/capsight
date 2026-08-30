import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function sanitizeMarkdownHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

export function renderMarkdownHtml(markdown: string): string {
  const parsed = marked.parse(markdown, { async: false });
  const rawHtml = typeof parsed === "string" ? parsed : "";
  return sanitizeMarkdownHtml(rawHtml);
}

interface MarkdownBodyProps {
  markdown: string;
}

export function MarkdownBody({ markdown }: MarkdownBodyProps) {
  const html = useMemo(() => renderMarkdownHtml(markdown), [markdown]);

  if (!markdown.trim()) {
    return <p className="empty-state">No body content.</p>;
  }

  return (
    <div
      className="markdown-body"
      data-testid="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
