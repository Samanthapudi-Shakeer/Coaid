import subprocess
from pathlib import Path
from .workspace_fs import safe_resolve
COMMANDS = {'oclint': ['oclint', '-report-type', 'json'], 'htmllint': ['htmlhint', '--format', 'json'], 'pmd': ['pmd', 'check', '--format', 'json']}
def run_language_tool(workspace_dir: Path, path: str, engine: str) -> dict:
    try: target = safe_resolve(workspace_dir, path)
    except ValueError as exc: return {'findings': [], 'raw': '', 'error': str(exc)}
    command = COMMANDS[engine] + [str(target)]
    try: result = subprocess.run(command, cwd=workspace_dir, capture_output=True, text=True, timeout=90)
    except FileNotFoundError: return {'findings': [], 'raw': '', 'error': f'{engine} is not installed on this server.'}
    except subprocess.TimeoutExpired: return {'findings': [], 'raw': '', 'error': f'{engine} timed out.'}
    raw = result.stdout or result.stderr
    return {'findings': [{'path': path, 'line': 1, 'column': 1, 'type': 'warning', 'symbol': engine, 'message': raw[:1000], 'messageId': engine}] if raw.strip() else [], 'raw': raw, 'error': None}
