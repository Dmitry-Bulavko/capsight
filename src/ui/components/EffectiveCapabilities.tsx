import type { EffectiveConfiguration } from "../../core/model/index.js";

interface EffectiveCapabilitiesProps {
  effective: EffectiveConfiguration | null;
  loading: boolean;
  error: string | null;
  selectedCapabilityId: string | null;
  onSelectCapability: (capabilityId: string) => void;
}

export function EffectiveCapabilities({
  effective,
  loading,
  error,
  selectedCapabilityId,
  onSelectCapability,
}: EffectiveCapabilitiesProps) {
  return (
    <section className="panel effective-capabilities">
      <h2>Effective capabilities</h2>
      {loading && <p className="empty-state">Loading capabilities…</p>}
      {!loading && error && <p className="error-message">{error}</p>}
      {!loading && !error && effective && (
        <>
          {effective.capabilities.length === 0 ? (
            <p className="empty-state">No capabilities resolved.</p>
          ) : (
            <ul className="capability-items capability-items-grid">
              {[...effective.capabilities]
                .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId))
                .map((capability) => (
                  <li key={capability.capabilityId}>
                    <button
                      type="button"
                      className={`capability-item capability-status-${capability.status}${
                        selectedCapabilityId === capability.capabilityId
                          ? " capability-item-selected"
                          : ""
                      }`}
                      onClick={() => onSelectCapability(capability.capabilityId)}
                    >
                      <span className="capability-id mono">{capability.capabilityId}</span>
                      <span className={`capability-status-badge status-${capability.status}`}>
                        {capability.status}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
