export {
  detectCursorVersion,
  defaultCommandRunner,
  type CommandRunner,
  type DetectCursorVersionOptions,
} from "./detect.js";
export {
  compareSemver,
  gateCapability,
  gateCollision,
  gateDiscovery,
  gateWarning,
  isMatrixId,
  lookupFeature,
  MATRIX,
  resolveEnforcement,
  VERSION_MATRIX,
  type FeatureCompatibility,
  type MatrixId,
  type ResolveEnforcementInput,
} from "./matrix.js";
export {
  FACT,
  FACTS,
  factConfidence,
  factsByConfidence,
  isFactId,
  type Fact,
  type FactId,
} from "./facts.js";
