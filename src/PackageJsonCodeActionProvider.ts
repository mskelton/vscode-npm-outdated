import semverGt from "semver/functions/gt"
import vscode from "vscode"
import { fetchPackage, parsePackage } from "./utils/packages"

export class PackageJsonCodeActionProvider
  implements vscode.CodeActionProvider {
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<(vscode.Command | vscode.CodeAction)[]> {
    const line = document.lineAt(range.start.line)

    const localPackage = parsePackage(line.text)
    const registryPackage = localPackage.name
      ? await fetchPackage(localPackage.name)
      : undefined

    if (localPackage.version && registryPackage?.version) {
      const outdated = semverGt(registryPackage.version, localPackage.version)
      // return vscode.commands.executeCommand("workbench.action")
    }

    const actions = context.diagnostics.map((error) => {
      return {
        diagnostics: [error],
        edit: {
          edits: [
            {
              edits: [
                {
                  range: error,
                  text: "This text replaces the text with the error",
                },
              ],
              resource: document.uri,
            },
          ],
        },
        isPreferred: true,
        kind: "quickfix",
        title: `Example quick fix`,
      }
    })

    return {
      actions,
      dispose() {},
    }
  }
}
