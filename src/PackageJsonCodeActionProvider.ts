import vscode from "vscode"
import { fetchPackage, parsePackage } from "./utils/packages"

export class PackageJsonCodeActionProvider
  implements vscode.CodeActionProvider {
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<vscode.Command[] | undefined> {
    const line = document.lineAt(range.start.line)
    const { name, version } = parsePackage(line.text)
    console.log(name, version)
    // fetchPackage(name)

    // return vscode.commands.executeCommand("workbench.action")
  }
}
