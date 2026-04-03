import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';

const execFileAsync = util.promisify(execFile);

function git(args: string[], cwd: string) {
  return execFileAsync('git', args, { cwd });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await git(['rev-parse', '--git-dir'], cwd);
    return true;
  } catch {
    return false;
  }
}

async function isTrackedByGit(filePath: string, cwd: string): Promise<boolean> {
  try {
    const { stdout } = await git(['ls-files', '--error-unmatch', filePath], cwd);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function gitWithRetry(args: string[], cwd: string, retries = 5, delayMs = 200): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await git(args, cwd);
      return;
    } catch (err) {
      const isLock = (err as Error).message.includes('index.lock');
      if (!isLock || attempt === retries) {
        throw err;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
}

async function stageRename(oldPath: string, newPath: string, cwd: string): Promise<void> {
  const isDir = fs.existsSync(newPath) && fs.statSync(newPath).isDirectory();
  const rmArgs = ['rm', '--cached', '--ignore-unmatch', ...(isDir ? ['-r'] : []), oldPath];

  await gitWithRetry(rmArgs, cwd);
  await gitWithRetry(['add', newPath], cwd);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidRenameFiles((event) => {
    if (!vscode.workspace.getConfiguration('gitMove').get<boolean>('enabled', true)) {
      return;
    }

    const showNotifications = vscode.workspace
      .getConfiguration('gitMove')
      .get<boolean>('showNotifications', false);

    // Fire and forget — do not await. We must return synchronously so VS Code
    // can process other onDidRenameFiles handlers (e.g. the import update popup).
    void Promise.all(event.files.map(async ({ oldUri, newUri }) => {
      const cwd =
        vscode.workspace.getWorkspaceFolder(newUri)?.uri.fsPath ??
        vscode.workspace.getWorkspaceFolder(oldUri)?.uri.fsPath;

      if (!cwd || !(await isGitRepo(cwd))) { return; }

      const oldPath = oldUri.fsPath;
      const newPath = newUri.fsPath;

      if (!(await isTrackedByGit(oldPath, cwd))) { return; }

      try {
        await stageRename(oldPath, newPath, cwd);

        if (showNotifications) {
          const rel = (p: string) => vscode.workspace.asRelativePath(p, false);
          vscode.window.showInformationMessage(
            `git-move: staged rename ${rel(oldPath)} → ${rel(newPath)}`
          );
        }
      } catch (err) {
        vscode.window.showWarningMessage(
          `git-move: failed to stage rename in git — ${(err as Error).message}`
        );
      }
    }));
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
