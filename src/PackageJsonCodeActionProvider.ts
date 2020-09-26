import vscode from "vscode"
import { commands } from "./commands"
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
    // Get all diagnostics from this extension
    const diagnostics = ctx.diagnostics.filter(
      (diagnostic) => diagnostic.code === DIAGNOSTIC_CODE
    )

    // For each diagnostic from this extension, create a code action
    const promises = range.isSingleLine
      ? diagnostics.map((diag) => this.createCommandCodeAction(doc, diag))
      : [
          this.createUpdateManyCodeAction(
            doc,
            diagnostics,
            `Update ${diagnostics.length} packages`
          ),
        ]

    const allDiagnostics = vscode.languages
      .getDiagnostics(doc.uri)
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODE)

    // Only show the update all code action if there are outdated packages
    if (allDiagnostics.length) {
      promises.push(
        this.createUpdateManyCodeAction(
          doc,
          allDiagnostics,
          "Update all packages"
        )
      )
    }

    return Promise.all(promises)
  }

  private createAction(
    doc: vscode.TextDocument,
    message: string,
    commandMessage: string
  ) {
    const edit = new vscode.WorkspaceEdit()
    const action = new vscode.CodeAction(
      message,
      vscode.CodeActionKind.QuickFix
    )

    action.edit = edit
    action.command = {
      arguments: [commandMessage, doc.uri],
      command: commands.notify,
      title: "update",
    }

    return [action, edit] as const
  }

  private async createUpdateManyCodeAction(
    doc: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[],
    message: string
  ) {
    const [action, edit] = this.createAction(
      doc,
      message,
      `Package${diagnostics.length > 1 ? "s" : ""} updated successfully.`
    )
    action.diagnostics = diagnostics

    await Promise.all(
      action.diagnostics.map((diagnostic) =>
        this.createEdit(edit, doc, diagnostic.range)
      )
    )

    return action
  }

  private async createCommandCodeAction(
    doc: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ) {
    const [action, edit] = this.createAction(
      doc,
      "Update package",
      "Package update successfully."
    )

    action.isPreferred = true
    action.diagnostics = [diagnostic]

    await this.createEdit(edit, doc, diagnostic.range)

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
