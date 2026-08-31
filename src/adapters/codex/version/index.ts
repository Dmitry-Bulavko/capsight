export {
  detectCodexVersion,
  defaultCommandRunner,
  type CommandRunner,
  type DetectCodexVersionOptions,
} from "./detect.js";
export {
  compareSemver,
  gateCapability,
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
  isFactId,
  type Fact,
  type FactId,
} from "./facts.js";
