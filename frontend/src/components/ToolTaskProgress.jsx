import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';

const FALLBACK_PHASE = 'Preparing isolated Aider session';

/** Live progress for the hidden Modularization/Test Generation Aider process. */
export default function ToolTaskProgress({ running, statusPath }) {
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    if (!running) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await apiGet(statusPath);
        if (!cancelled) setPhases(status.phaseTimeline || []);
      } catch (_) {
        // The task request itself reports actionable failures; progress is best effort.
      }
    };
    setPhases([]);
    refresh();
    const timer = setInterval(refresh, 700);
    return () => { cancelled = true; clearInterval(timer); };
  }, [running, statusPath]);

  if (!running) return null;
  const current = phases[phases.length - 1]?.label || FALLBACK_PHASE;
  return (
    <section className="tool-progress" aria-live="polite">
      <div className="tool-progress-current"><span className="spinner" /> {current}</div>
      <div className="tool-progress-phases">
        {phases.length === 0 ? <span>Waiting for Aider to start…</span> : phases.map((phase, index) => (
          <span key={`${phase.label}-${phase.at}`} className={index === phases.length - 1 ? 'active' : ''}>✓ {phase.label}</span>
        ))}
      </div>
    </section>
  );
}
