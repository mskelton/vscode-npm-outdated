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
    // TODO: Update command to allow multiline selection
    if (!range.isSingleLine) {
      return Promise.resolve([])
    }

    // For each diagnostic entry that has the matching `code`,
    // create a code action command.
    const promises = ctx.diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODE)
      .map((diagnostic) => this.createCommandCodeAction(doc, diagnostic))

    const allDiagnostics = vscode.languages
      .getDiagnostics(doc.uri)
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODE)

    // Only show the update all code action if there are outdated packages
    if (allDiagnostics.length) {
      promises.push(this.createUpdateAllCodeAction(doc, allDiagnostics))
    }

    return Promise.all(promises)
  }

  private async createUpdateAllCodeAction(
    doc: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ) {
    const edit = new vscode.WorkspaceEdit()
    const action = new vscode.CodeAction(
      "Update all packages",
      vscode.CodeActionKind.QuickFix
    )

    action.edit = edit
    action.isPreferred = true
    action.diagnostics = diagnostics

    const promises = action.diagnostics.map((diagnostic) =>
      this.createEdit(edit, doc, diagnostic.range)
    )
    await Promise.all(promises)

    return action
  }

  private async createCommandCodeAction(
    doc: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ) {
    const edit = new vscode.WorkspaceEdit()
    const action = new vscode.CodeAction(
      "Update package",
      vscode.CodeActionKind.QuickFix
    )

    await this.createEdit(edit, doc, diagnostic.range)

    action.edit = edit
    action.diagnostics = [diagnostic]
    action.isPreferred = true

    return action
  }

  private async createEdit(
    edit: vscode.WorkspaceEdit,
    doc: vscode.TextDocument,
    range: vscode.Range
  ) {
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
  }
}
