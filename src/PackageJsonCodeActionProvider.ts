import vscode from "vscode"
import { fetchPackage } from "./utils/packages"
import { parseDependency } from "./utils/parseDependency"
import { DIAGNOSTIC_CODE } from "./utils/vars"

export class PackageJsonCodeActionProvider
  implements vscode.CodeActionProvider {
  provideCodeActions(
    doc: vscode.TextDocument,
    range: vscode.Range,
    ctx: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[]> {
    // TODO: Add a single command to update all the packages
    if (!range.isSingleLine) {
      return Promise.resolve([])
    }

    // For each diagnostic entry that has the matching `code`,
    // create a code action command.
    const promises = ctx.diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODE)
      .map((diagnostic) => this.createCommandCodeAction(doc, diagnostic))

    return Promise.all(promises)
  }

  private async createCommandCodeAction(
    doc: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ) {
    const action = new vscode.CodeAction(
      "Update package to latest version",
      vscode.CodeActionKind.QuickFix
    )

    action.edit = await this.createEdit(doc, diagnostic.range)
    action.diagnostics = [diagnostic]
    action.isPreferred = true

    return action
  }

  private async createEdit(doc: vscode.TextDocument, range: vscode.Range) {
    const edit = new vscode.WorkspaceEdit()

    // Get the latest version from the registry
    const line = doc.lineAt(range.start.line)
    const { name, version } = parseDependency(line.text)

    // This check shouldn't be necessary, but the types are overly strong
    // so this is an extra safety check
    if (name && version) {
      // Keep the existing version prefix if it exists.
      const prefix = ["~", "^"].includes(version[0]) ? version[0] : ""
      const info = await fetchPackage(name)

      if (info) {
        edit.replace(doc.uri, range, prefix + info.version)
      }
    }

    return edit
  }
}
