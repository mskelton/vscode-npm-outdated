import { sep } from "path"
import {
  coerce,
  diff,
  gt,
  lt,
  ReleaseType,
  SemVer,
  valid,
  validRange,
} from "semver"

import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  TextDocument,
  TextDocumentChangeEvent,
  TextEditor,
  window,
  workspace,
} from "vscode"

import { DIAGNOSTIC_ACTION } from "./CodeAction"
import { DocumentsPackagesInterface } from "./Document"
import { PackageInterface } from "./NPM"
import { getLevel } from "./Settings"

const PACKAGE_JSON_PATH = `${sep}package.json`

export const diagnosticSubscribe = (
  context: ExtensionContext,
  diagnostics: DiagnosticCollection,
  onChange: (document: TextDocument) => void
): void => {
  // Handles the active editor change, but only continues with package.json files.
  const handleChange = (document: TextDocument): void => {
    if (document.fileName.endsWith(PACKAGE_JSON_PATH)) {
      onChange(document)
    }
  }

  // Trigger on the currently active editor, if any..
  if (window.activeTextEditor) {
    handleChange(window.activeTextEditor.document)
  }

  // Trigger when the active editor changes.
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor) {
        handleChange(editor.document)
      }
    })
  )

  // Trigger when the active document text is modified.
  context.subscriptions.push(
    workspace.onDidChangeTextDocument((editor: TextDocumentChangeEvent) =>
      handleChange(editor.document)
    )
  )

  // Trigger when the active document is closed, removing the current document from the diagnostic collection.
  context.subscriptions.push(
    workspace.onDidCloseTextDocument((document: TextDocument) =>
      diagnostics.delete(document.uri)
    )
  )
}

const PACKAGE_DIFF_LEVELS: Record<ReleaseType, number> = {
  major: 2,
  minor: 1,
  patch: 0,
  // Ignore any pre-release diff:
  premajor: -1,
  preminor: -1,
  prepatch: -1,
  prerelease: -1,
}

export const reportDiagnostics = (
  packagesUpdateds: Record<string, PackageInterface>,
  packagesLocals: DocumentsPackagesInterface
): Diagnostic[] => {
  const diagnostics = [],
    versionDiff = getLevel()

  for (const [documentPackageName, documentPackage] of Object.entries(
    packagesLocals
  )) {
    if (!validRange(documentPackage.version)) {
      diagnostics.push(
        new Diagnostic(
          documentPackage.versionRange,
          "Invalid package version.",
          DiagnosticSeverity.Error
        )
      )

      continue
    }

    if (!packagesUpdateds[documentPackageName]) {
      continue
    }

    const packageVersion = coerce(documentPackage.version) as SemVer

    if (!valid(packageVersion)) {
      continue
    }

    const packageDiff = diff(
      packagesUpdateds[documentPackageName].latestVersion,
      packageVersion
    )

    if (
      packageDiff &&
      versionDiff &&
      PACKAGE_DIFF_LEVELS[packageDiff] < PACKAGE_DIFF_LEVELS[versionDiff]
    ) {
      continue
    }

    if (
      gt(packagesUpdateds[documentPackageName].latestVersion, packageVersion)
    ) {
      const diagnostic = new Diagnostic(
        documentPackage.versionRange,
        `Newer version of ${documentPackageName} is available: ${packagesUpdateds[documentPackageName].latestVersion}.`,
        DiagnosticSeverity.Warning
      )

      diagnostic.code = DIAGNOSTIC_ACTION + ":" + documentPackageName
      diagnostics.push(diagnostic)
    } else if (
      lt(packagesUpdateds[documentPackageName].latestVersion, packageVersion)
    ) {
      diagnostics.push(
        new Diagnostic(
          documentPackage.versionRange,
          `Version of ${documentPackageName} is greater than latest version: ${packagesUpdateds[documentPackageName].latestVersion}.`,
          DiagnosticSeverity.Information
        )
      )
    }
  }

  return diagnostics
}
