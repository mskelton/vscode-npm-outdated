import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  languages,
  Range,
  TextDocument,
  WorkspaceEdit,
} from "vscode"

import { COMMAND_INSTALL_REQUEST } from "./Command"
import { PackageRelatedDiagnostic } from "./Diagnostic"
import { hasMajorUpdateProtection } from "./Settings"

export const DIAGNOSTIC_ACTION = "npm-outdated"

const VERSION_PREFIX_REGEXP = /^\s*(\^|~|=|>=|<=)/

export class PackageJsonCodeActionProvider implements CodeActionProvider {
  async provideCodeActions(
    document: TextDocument,
    range: Range
  ): Promise<CodeAction[]> {
    // Get all diagnostics from this extension
    const diagnostics = languages
      .getDiagnostics(document.uri)
      .filter(
        (diagnostic) =>
          typeof diagnostic.code === "object" &&
          diagnostic.code.value === DIAGNOSTIC_ACTION
      ) as PackageRelatedDiagnostic[]

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
    if (diagnosticsSelected.length === 1) {
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
      let updateWarning = ""
      let diagnosticsFiltered = diagnostics

      // Ensures that we will not include major updates together with minor, if protection is enabled.
      if (hasMajorUpdateProtection()) {
        const diagnosticsMajors: PackageRelatedDiagnostic[] = []

        for (const diagnostic of diagnostics) {
          if (await diagnostic.packageRelated.isVersionMajorUpdate()) {
            diagnosticsMajors.push(diagnostic)
          }
        }

        if (diagnosticsMajors.length) {
          if (diagnosticsMajors.length < diagnostics.length) {
            updateWarning = " (excluding majors)"
            diagnosticsFiltered = diagnosticsFiltered.filter(
              (diagnostic) => !diagnosticsMajors.includes(diagnostic)
            )
          } else {
            updateWarning = " (major)"
          }
        }
      }

      diagnosticsPromises.push(
        this.createUpdateManyAction(
          document,
          diagnosticsFiltered,
          `Update all ${diagnosticsFiltered.length} packages${updateWarning}`
        )
      )
    }

    return Promise.all(diagnosticsPromises)
  }

  private async createAction(
    document: TextDocument,
    message: string,
    diagnostics: PackageRelatedDiagnostic[],
    isPreferred?: boolean
  ) {
    const edit = new WorkspaceEdit()
    const action = new CodeAction(message, CodeActionKind.QuickFix)

    action.edit = edit
    action.diagnostics = diagnostics
    action.isPreferred = isPreferred

    let requiresUpdate = false

    for (const diagnostic of diagnostics) {
      if (
        !(await diagnostic.packageRelated.isVersionLatestAlreadyInstalled())
      ) {
        requiresUpdate = true
        break
      }
    }

    if (requiresUpdate) {
      action.command = {
        arguments: [document.uri],
        command: COMMAND_INSTALL_REQUEST,
        title: "update",
      }
    }

    return action
  }

  private async createUpdateManyAction(
    doc: TextDocument,
    diagnostics: PackageRelatedDiagnostic[],
    message: string
  ) {
    const action = await this.createAction(doc, message, diagnostics)

    await Promise.all(
      diagnostics.map((diagnostic) =>
        this.updatePackageVersion(action, doc, diagnostic)
      )
    )

    return action
  }

  private async createUpdateSingleAction(
    document: TextDocument,
    diagnostic: PackageRelatedDiagnostic
  ) {
    const versionLatest = await diagnostic.packageRelated.getVersionLatest()

    const action = this.createAction(
      document,
      `Update "${diagnostic.packageRelated.name}" to ${versionLatest}`,
      [diagnostic],
      true
    )

    await this.updatePackageVersion(await action, document, diagnostic)

    return action
  }

  private async updatePackageVersion(
    action: CodeAction,
    document: TextDocument,
    diagnostic: PackageRelatedDiagnostic
  ) {
    const line = document.lineAt(diagnostic.range.start.line),
      version = line.text.slice(
        diagnostic.range.start.character,
        diagnostic.range.end.character
      ),
      versionPrefix = version.match(VERSION_PREFIX_REGEXP)?.[1] ?? "",
      versionUpdated = await diagnostic.packageRelated.getVersionLatest()

    action.edit?.replace(
      document.uri,
      diagnostic.range,
      versionPrefix + versionUpdated
    )
  }
}
