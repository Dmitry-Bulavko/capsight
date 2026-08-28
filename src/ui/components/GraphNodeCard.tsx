function GraphNodeCard({ kind, label }: { kind: string; label: string }) {
  return (
    <div className="graph-node">
      <span className="graph-node-kind">{kind.replace("_", " ")}</span>
      <span className="graph-node-label">{label}</span>
    </div>
  );
}

export function graphNodeTypes() {
  return {
    default: ({
      data,
    }: {
      data: { label: string; kind: string };
    }) => <GraphNodeCard kind={data.kind} label={data.label} />,
  };
}
