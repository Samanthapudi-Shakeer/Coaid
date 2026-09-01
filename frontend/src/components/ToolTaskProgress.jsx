import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';

const FALLBACK_PHASE = 'Preparing isolated Aider session';

function decode(raw = []) {
  try { return raw.map((value) => atob(value)).join(''); } catch (_) { return ''; }
}

/** Live progress, optional terminal output, and human answers for hidden tool Aider sessions. */
export default function ToolTaskProgress({ running, statusPath, terminalEnabled = false }) {
  const [status, setStatus] = useState(null);
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    if (!running) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try { const next = await apiGet(statusPath); if (!cancelled) setStatus(next); } catch (_) { /* request shows errors */ }
    };
    setStatus(null); refresh();
    const timer = setInterval(refresh, 700);
    return () => { cancelled = true; clearInterval(timer); };
  }, [running, statusPath]);

  if (!running) return null;
  const phases = status?.phaseTimeline || [];
  const current = phases.at(-1)?.label || FALLBACK_PHASE;
  const question = status?.pendingQuestion;
  const answerQuestion = async (value) => {
    if (!value.trim()) return;
    await apiPost(`${statusPath.replace('/status', '/answer')}`, { text: value });
    setAnswer('');
  };
  return <section className="tool-progress" aria-live="polite">
    <div className="tool-progress-current"><span className="spinner" /> {current}</div>
    <div className="tool-progress-phases">{phases.length === 0 ? <span>Waiting for Aider to start…</span> : phases.map((phase, index) => <span key={`${phase.label}-${phase.at}`} className={index === phases.length - 1 ? 'active' : ''}>✓ {phase.label}</span>)}</div>
    {question && <div className="tool-human-question"><strong>Aider needs your answer:</strong> {question.question || question.text || 'Continue?'}
      <div>{(question.options || [{ key: 'Y', label: 'Y' }, { key: 'N', label: 'N' }]).map((option) => { const value = typeof option === 'string' ? option : (option.key || option.label); return <button className="btn small" key={value} onClick={() => answerQuestion(value)}>{typeof option === 'string' ? option : option.label}</button>; })}</div>
      <div className="tool-answer"><input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type Y/N or another answer" onKeyDown={(e) => e.key === 'Enter' && answerQuestion(answer)} /><button className="btn small primary" onClick={() => answerQuestion(answer)}>Send</button></div>
    </div>}
    {terminalEnabled && <pre className="tool-terminal">{decode(status?.raw) || 'Waiting for terminal output…'}</pre>}
  </section>;
}
