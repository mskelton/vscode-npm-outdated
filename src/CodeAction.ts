import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Diagnostic,
  languages,
  Range,
  TextDocument,
  WorkspaceEdit,
} from "vscode"

import { COMMAND_NOTIFY } from "./Command"
import { getPackageLatestVersion } from "./NPM"
import { isCodeAction } from "./Utils"

export const DIAGNOSTIC_ACTION = "npm-outdated"

const VERSION_PREFIX_REGEXP = /^\s*(\^|~|>=|<=)/

const getDiagnosticPackageName = (diagnostic: Diagnostic): string => {
  if (isCodeAction(diagnostic.code)) {
    return diagnostic.code.split(":", 3)[1]
  }

  return ""
}

export class PackageJsonCodeActionProvider implements CodeActionProvider {
  provideCodeActions(
    document: TextDocument,
    range: Range
  ): Promise<CodeAction[]> {
    // Get all diagnostics from this extension
    const diagnostics = languages
      .getDiagnostics(document.uri)
      .filter(
        (diagnostic) =>
          isCodeAction(diagnostic.code) &&
          diagnostic.code.startsWith(`${DIAGNOSTIC_ACTION}:`)
      )

    // Checks if an CodeAction comes through a diagnostic.
    const diagnosticsSelected = diagnostics.filter((diagnostic) =>
      diagnostic.range.intersection(range)
    )

    if (!diagnosticsSelected.length) {
      return Promise.resolve([])
    }

    const diagnosticsPromises = []

    // If only a single-line is selected or range accepts only one diagnostic then create a direct action for a specific package.
    // Else, it will be suggested to update all <number of> packages within range.
    if (range.isSingleLine || diagnosticsSelected.length === 1) {
      diagnosticsPromises.push(
        ...diagnosticsSelected.map((diagnostic) =>
          this.createUpdateSingleAction(document, diagnostic)
        )
      )
    } else {
      diagnosticsPromises.push(
        this.createUpdateManyAction(
          document,
          diagnosticsSelected,
          `Update ${diagnosticsSelected.length} packages`
        )
      )
    }

    // If the total number of diagnostics is greater than the number of selected ones, then it is suggested to update all.
    if (
      diagnostics.length > 1 &&
      diagnostics.length > diagnosticsSelected.length
    ) {
      diagnosticsPromises.push(
        this.createUpdateManyAction(
          document,
          diagnostics,
          `Update all ${diagnostics.length} packages`
        )
      )
    }

    return Promise.all(diagnosticsPromises)
  }

  private createAction(
    document: TextDocument,
    message: string,
    diagnostics: Diagnostic[],
    isPrefered?: boolean
  ) {
    const edit = new WorkspaceEdit()
    const action = new CodeAction(message, CodeActionKind.QuickFix)

    action.edit = edit
    action.diagnostics = diagnostics
    action.isPreferred = isPrefered
    action.command = {
      arguments: [document.uri],
      command: COMMAND_NOTIFY,
      title: "update",
    }

    return action
  }

  private async createUpdateManyAction(
    doc: TextDocument,
    diagnostics: Diagnostic[],
    message: string
  ) {
    const action = this.createAction(doc, message, diagnostics)

    await Promise.all(
      diagnostics.map((diagnostic) =>
        this.updatePackageVersion(action, doc, diagnostic)
      )
    )

    return action
  }

  private async createUpdateSingleAction(
    document: TextDocument,
    diagnostic: Diagnostic
  ) {
    const action = this.createAction(
      document,
      `Update ${getDiagnosticPackageName(diagnostic)} package`,
      [diagnostic],
      true
    )

    await this.updatePackageVersion(action, document, diagnostic)

    return action
  }

  private async updatePackageVersion(
    action: CodeAction,
    document: TextDocument,
    diagnostic: Diagnostic
  ) {
    const line = document.lineAt(diagnostic.range.start.line),
      version = line.text.slice(
        diagnostic.range.start.character,
        diagnostic.range.end.character
      ),
      versionPrefix = version.match(VERSION_PREFIX_REGEXP)?.[1] ?? "",
      versionUpdated = await getPackageLatestVersion(
        getDiagnosticPackageName(diagnostic)
      )

    action.edit?.replace(
      document.uri,
      diagnostic.range,
      versionPrefix + versionUpdated
    )
  }
}
