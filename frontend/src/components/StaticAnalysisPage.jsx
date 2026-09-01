import React, { useState } from 'react';
import { apiPost } from '../api';
import { useWorkspaceFilesAndModels } from '../hooks/useWorkspaceFilesAndModels';
import ToolControls from './ToolControls';
import DiffView from './DiffView';
import SaveFileModal from './SaveFileModal';
import Toasts from './Toasts';

let toastId = 0;

export default function StaticAnalysisPage({ workspaces, currentWorkspace, onSelectWorkspace, onCreateWorkspace }) {
  const tw = useWorkspaceFilesAndModels(currentWorkspace);
  const [selectedModel, setSelectedModel] = useState('');
  const [engine, setEngine] = useState('semgrep');
  const [target, setTarget] = useState('');
  const [filters, setFilters] = useState({ error: true, warning: true, refactor: true });
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [findings, setFindings] = useState(null);
  const [fixResult, setFixResult] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const wsApi = (path) => `/api/ws/${encodeURIComponent(currentWorkspace)}${path}`;
  const toast = (message, kind = 'info') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };

  async function analyze() {
    if (!target) return;
    setAnalyzing(true);
    setFindings(null);
    setFixResult(null);
    try {
      const result = await apiPost(wsApi('/lint/analyze'), { path: target, engine });
      setFindings(result.findings);
      toast(`Found ${result.findings.length} issue(s)`, result.findings.length ? 'info' : 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function autofix() {
    if (target.endsWith('/')) return;
    setFixing(true);
    try {
      const result = await apiPost(wsApi('/lint/autofix'), { path: target, model: selectedModel });
      setFixResult(result);
      toast(result.changed ? 'Fix generated — review the diff below' : 'Model made no changes', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setFixing(false);
    }
  }

  async function save(path) {
    try {
      await apiPost(wsApi('/files/write'), { path, content: fixResult.result });
      toast(`Saved ${path}`, 'success');
      setSaveOpen(false);
      tw.refreshWorkspaceFiles();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const folders = [...new Set(tw.workspaceFiles
    .map((f) => f.path.split('/').slice(0, -1).join('/'))
    .filter(Boolean))];
  const visibleFindings = (findings || []).filter((finding) => {
    const kind = finding.type === 'fatal' ? 'error' : finding.type;
    return Boolean(filters[kind]);
  });

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1>🧹 Static Code Analysis</h1>
        <p>Runs Semgrep by default, or pylint, directly against one file or a folder. Only static-analysis findings are shown; formatting checks such as line length are not included. Review any proposed fix before applying it.</p>
      </div>

      <ToolControls
        workspaces={workspaces} currentWorkspace={currentWorkspace}
        onSelectWorkspace={onSelectWorkspace} onCreateWorkspace={onCreateWorkspace}
        workspaceFiles={tw.workspaceFiles} selectedFile={target} onSelectFile={setTarget}
        models={tw.models} selectedModel={selectedModel} onSelectModel={setSelectedModel}
      />

      <div className="tool-controls">
        <div className="field"><label>Analyzer</label><select value={engine} onChange={(e) => setEngine(e.target.value)}><option value="semgrep">Semgrep</option><option value="pylint">Pylint</option></select></div>
        <div className="field"><label>Or analyze folder</label><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Select a file or folder</option>{folders.map((folder) => <option key={folder} value={`${folder}/`}>{folder}/</option>)}</select></div>
      </div>

      <div className="tool-actions">
        <button className="btn primary" onClick={analyze} disabled={!target || analyzing}>
          {analyzing ? 'Analyzing…' : `▶ Run ${engine}`}
        </button>
      </div>

      <div className="tool-dashboard">
        {findings && (
          <div className="tool-card">
            <div className="tool-card-header">
              <span>Findings ({visibleFindings.length} of {findings.length})</span>
              <div className="finding-filters" aria-label="Filter findings">
                {['error', 'warning', 'refactor'].map((type) => <label key={type}><input type="checkbox" checked={filters[type]} onChange={(e) => setFilters((old) => ({ ...old, [type]: e.target.checked }))} /> {type}s</label>)}
              </div>
              {findings.length > 0 && !target.endsWith('/') && (
                <button className="btn small primary" onClick={autofix} disabled={fixing || !selectedModel || engine !== 'pylint'} title={engine !== 'pylint' ? 'Auto-fix uses pylint findings' : ''}>
                  {fixing ? 'Fixing…' : '✨ Auto-fix with Ollama'}
                </button>
              )}
            </div>
            {visibleFindings.length === 0 ? (
              <div className="empty">No issues found.</div>
            ) : (
              <ul className="findings-list">
                {visibleFindings.map((f, i) => (
                  <li key={i} className={`finding-${f.type}`}>
                    <span className="finding-badge">{f.type}</span>
                    <span className="mono small">{f.path && `${f.path} `}L{f.line}:{f.column}</span>
                    <span className="finding-symbol mono">{f.symbol}</span>
                    <span className="finding-msg">{f.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {fixResult && (
          <div className="tool-card">
            <div className="tool-card-header">
              <span>Proposed fix ({fixResult.model})</span>
              {fixResult.changed && (
                <>
                  <button className="btn small primary" onClick={() => save(target)}>✓ Apply to original</button>
                  <button className="btn small" onClick={() => setSaveOpen(true)}>Save as…</button>
                </>
              )}
            </div>
            {!fixResult.changed ? (
              <div className="empty">The model didn't propose any changes.</div>
            ) : (
              <DiffView diff={fixResult.diff} />
            )}
          </div>
        )}
      </div>

      <SaveFileModal
        open={saveOpen}
        defaultPath={target}
        onCancel={() => setSaveOpen(false)}
        onConfirm={save}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
