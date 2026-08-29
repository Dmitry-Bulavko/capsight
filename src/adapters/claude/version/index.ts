export {
  detectClaudeVersion,
  defaultCommandRunner,
  type CommandRunner,
  type DetectClaudeVersionOptions,
} from "./detect.js";
export {
  compareSemver,
  gateCapability,
  isMatrixId,
  lookupFeature,
  resolveEnforcement,
  MATRIX,
  VERSION_MATRIX,
  type Enforcement,
  type EnforcementDecision,
  type FeatureCompatibility,
  type MatrixId,
  type ResolveEnforcementInput,
} from "./matrix.js";
