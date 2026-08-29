/** Layout spacing for Workflow Lab canvas — row-based agent streams. */
export const WORKFLOW_LAYOUT = {
  /** Horizontal gap between cards in one agent row. */
  nodeGapH: 44,
  /** Vertical gap between agent rows (horizontal bands). */
  rowGap: 152,
  rowPadX: 40,
  rowPadTop: 48,
  canvasOriginX: 48,
  /** Gutter between orchestrator skill and agent rows — edges route here. */
  skillColumnGap: 168,
  /** Padding around row band groups. */
  rowBandPad: 40,
  canvasBottomPad: 96,
  /** In-row edge bend distance. */
  edgeOffset: 48,
  edgeBorderRadius: 24,
  /** Skill → agent edges run through skillColumnGap before turning. */
  skillEdgeOffset: 140,
  /** Spawn chain between rows (bottom → top). */
  spawnEdgeOffset: 56,
} as const;
