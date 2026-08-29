interface WorkflowSwimlaneGroupProps {
  data: {
    label: string;
    displayLabel?: string;
    accentColor: string;
  };
}

export function WorkflowSwimlaneGroup({ data }: WorkflowSwimlaneGroupProps) {
  const header = data.displayLabel ?? data.label.toUpperCase();

  return (
    <div className="workflow-swimlane-group">
      <div
        className="workflow-swimlane-group-label"
        style={{ color: data.accentColor }}
      >
        {header}/
      </div>
    </div>
  );
}

export function workflowSwimlaneGroupTypes() {
  return {
    swimlane: WorkflowSwimlaneGroup,
  };
}
