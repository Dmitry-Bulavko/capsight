import { useEffect, useState } from "react";
import type { PlatformId } from "../../adapters/platform.js";
import { ApiError, fetchPlan, fetchProject } from "../api.js";
import type { EditorPendingState } from "../state/editor-store.js";
import { countPendingChanges } from "../state/editor-store.js";
import type { ClaudeAgent as Agent } from "../../adapters/claude/model/index.js";

export function useAgentPlan(agent: Agent | null, pending: EditorPendingState) {
  const pendingCount = agent ? countPendingChanges(agent, pending) : 0;
  const hasPendingEdits = pendingCount > 0;

  const [platform, setPlatform] = useState<PlatformId>("claude");
  const [editSnapshotId, setEditSnapshotId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof fetchPlan>> | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProject()
      .then((summary) => {
        if (!cancelled) {
          setPlatform(summary.platform);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlatform("claude");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasPendingEdits) {
      setEditSnapshotId(null);
      setPlan(null);
      setPlanError(null);
      setPlanLoading(false);
      return;
    }

    if (editSnapshotId !== null) {
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    fetchPlan({ byAgent: {} }, "capture")
      .then((result) => {
        if (!cancelled) {
          setEditSnapshotId(result.snapshotId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPlanError(err instanceof Error ? err.message : "Plan failed");
          setPlanLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasPendingEdits, editSnapshotId]);

  useEffect(() => {
    if (!hasPendingEdits || editSnapshotId === null) {
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);

    fetchPlan(pending, editSnapshotId)
      .then((result) => {
        if (!cancelled) {
          setPlan(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setPlanError(err.message);
          } else {
            setPlanError(err instanceof Error ? err.message : "Plan failed");
          }
          setPlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pending, editSnapshotId, hasPendingEdits]);

  return {
    platform,
    plan,
    planLoading,
    planError,
    pendingCount,
    hasPendingEdits,
  };
}
