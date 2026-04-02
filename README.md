# Git Move

VS Code extension that automatically stages file renames as `git mv` when you move files in the Explorer — so git sees a rename (`R`) instead of a delete + untracked file (`D` + `??`).

Works alongside VS Code's built-in "Update imports?" prompt — this extension only handles the git side.

## How it works

When you move or rename a tracked file in the VS Code Explorer:

1. VS Code moves the file on disk as usual
2. This extension runs the equivalent of `git mv` by staging the rename in the git index:
   - `git rm --cached <old path>`
   - `git add <new path>`
3. `git status` now shows `R old -> new` instead of `D old` + `?? new`

Untracked files and non-git repos are silently skipped.

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitMove.enabled` | `true` | Enable/disable the extension without uninstalling |
| `gitMove.showNotifications` | `false` | Show a toast notification each time a rename is staged |