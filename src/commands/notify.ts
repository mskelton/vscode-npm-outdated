import { commands } from "."
import path from "path"
import vscode from "vscode"

async function isYarn(uri: vscode.Uri) {
  const path = uri.fsPath.replace("package.json", "yarn.lock")

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(path))
    return true
  } catch (e) {
    return false
  }
}

export async function notify(message: string, uri: vscode.Uri) {
  const yarn = await isYarn(uri)
  const installCommand = yarn ? "yarn" : "npm install"
  const action = `Run '${installCommand}'`

  const result = await vscode.window.showInformationMessage(
    `${message} Run your package manager install command to finish updating packages.`,
    action
  )

  if (result === action) {
    vscode.commands.executeCommand(
      commands.install,
      installCommand,
      path.dirname(uri.fsPath)
    )
  }
}
