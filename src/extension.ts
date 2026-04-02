import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';

const execFileAsync = util.promisify(execFile);

function git(args: string[], cwd: string) {
  return execFileAsync('git', args, { cwd });
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

async function stageRename(oldPath: string, newPath: string, cwd: string): Promise<void> {
  const isDir = fs.existsSync(newPath) && fs.statSync(newPath).isDirectory();
  const rmArgs = ['rm', '--cached', '--ignore-unmatch', ...(isDir ? ['-r'] : []), oldPath];

  await git(rmArgs, cwd);
  await git(['add', newPath], cwd);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidRenameFiles(async (event) => {
    const config = vscode.workspace.getConfiguration('gitMove');

    if (!config.get<boolean>('enabled', true)) {
      return;
    }

    const showNotifications = config.get<boolean>('showNotifications', false);

    for (const { oldUri, newUri } of event.files) {
      const workspaceFolder =
        vscode.workspace.getWorkspaceFolder(newUri) ??
        vscode.workspace.getWorkspaceFolder(oldUri);

      if (!workspaceFolder) {
        continue;
      }

      const cwd = workspaceFolder.uri.fsPath;

      if (!(await isGitRepo(cwd))) {
        continue;
      }

      const oldPath = oldUri.fsPath;
      const newPath = newUri.fsPath;

      const tracked = await isTrackedByGit(oldPath, cwd).catch(() => false);
      if (!tracked) {
        continue;
      }

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
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
