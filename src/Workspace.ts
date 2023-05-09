import { Uri, workspace } from "vscode"

export const getWorkspacePath = (uri: Uri): string =>
  workspace.getWorkspaceFolder(uri)!.uri.fsPath
