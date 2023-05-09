import { workspace } from "vscode"

export const getWorkspacePath = (): string | undefined =>
  workspace.workspaceFolders?.[0]?.uri.fsPath
