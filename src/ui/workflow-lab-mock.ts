import type { WorkflowLabGraph } from "./workflow-lab-types.js";
import { WORKFLOW_LAB_CATALOG } from "./workflow-lab-mock-catalog.js";
import {
  ORCHESTRATOR_DEMO_EDGES,
  ORCHESTRATOR_DEMO_NODES,
} from "./workflow-lab-mock-orchestrator-demo.js";

export const WORKFLOW_LAB_MOCK: WorkflowLabGraph = {
  nodes: [...WORKFLOW_LAB_CATALOG.nodes, ...ORCHESTRATOR_DEMO_NODES],
  edges: [...WORKFLOW_LAB_CATALOG.edges, ...ORCHESTRATOR_DEMO_EDGES],
};
