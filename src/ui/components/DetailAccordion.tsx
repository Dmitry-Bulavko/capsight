import type { ReactNode } from "react";

interface DetailAccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function DetailAccordion({ title, children, defaultOpen = false }: DetailAccordionProps) {
  return (
    <details className="resource-detail-accordion" open={defaultOpen || undefined}>
      <summary className="resource-detail-accordion-trigger">{title}</summary>
      <div className="resource-detail-accordion-body">{children}</div>
    </details>
  );
}

export function DetailAccordionGroup({ children }: { children: ReactNode }) {
  return <div className="resource-detail-accordions">{children}</div>;
}
