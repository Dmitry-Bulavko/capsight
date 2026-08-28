/**
 * Verified platform fact ID constants.
 * @see docs/SPEC.md §3
 */

// §3.2 Agent frontmatter
export const F2 = "F2";
export const F3 = "F3";
export const F4 = "F4";
export const F11 = "F11";

// §3.3 Context tool filters
export const T1 = "T1";
export const T2 = "T2";
export const T3 = "T3";

// §3.4 Permission mode
export const P1 = "P1";
export const P2 = "P2";
export const P4 = "P4";
export const P5 = "P5";

// §3.8 Subagent depth
export const N2 = "N2";

/** [doc] fact IDs referenced by M1 resolver rules. */
export const M1_DOC_FACTS = [
  F2,
  F3,
  F4,
  F11,
  T1,
  T2,
  T3,
  P1,
  P2,
  P4,
  P5,
  N2,
] as const;

export type M1DocFactId = (typeof M1_DOC_FACTS)[number];
