import type { PlanPendingState } from "./plan.js";

export class PendingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingValidationError";
  }
}

export function parsePendingJson(raw: string): PlanPendingState {
  let pending: PlanPendingState;
  try {
    pending = JSON.parse(raw) as PlanPendingState;
  } catch {
    throw new PendingValidationError("Invalid pending JSON");
  }

  if (typeof pending.byAgent !== "object" || pending.byAgent === null) {
    throw new PendingValidationError("Pending JSON must include a byAgent object");
  }

  return pending;
}
