// Version de l'application : instant de la construction (UTC, à la minute) et commit Git.
import { execSync } from 'node:child_process';

export function appVersion() {
  let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'local';
    }
  }
  return `${new Date().toISOString().slice(0, 16)}Z ${sha}`;
}
