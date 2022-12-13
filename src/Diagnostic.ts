import { sep } from "path"

import {
  coerce,
  diff,
  gt,
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
import { getDocumentPackages, PackageInfoChecked } from "./Document"
import { DocumentDiagnostics } from "./DocumentDiagnostics"
import { getPackageLatestVersion } from "./NPM"
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

export const getPackageDiagnostic = (
  packageInfoChecked: PackageInfoChecked
) => {
  // If the version specified by the user is not a valid range, it issues an error diagnostic.
  // Eg. { "package": "blah blah blah" }
  if (!validRange(packageInfoChecked.version)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      "Invalid package version.",
      DiagnosticSeverity.Error
    )
  }

  // If it is not possible to coerce to a valid version, it means that the versioning is a bit more complex and it would be difficult to evaluate it.
  // In this case, we'll just ignore it.
  // Eg. { "package": "^1.5 || ^2.0" }
  const packageVersion = coerce(packageInfoChecked.version) as SemVer

  if (!valid(packageVersion)) {
    return
  }

  // Check if the version difference is compatible with what was configured by the user.
  // If the difference is less than the minimum configured then there is no need for a diagnostic.
  // Eg. "1.0 => 1.1" is a "minor" diff(). By default, we allow any non-prerelease diff() starting from "patch".
  const versionDiff = getLevel()
  const packageDiff = diff(packageInfoChecked.versionLatest, packageVersion)

  if (
    packageDiff &&
    versionDiff &&
    PACKAGE_DIFF_LEVELS[packageDiff] < PACKAGE_DIFF_LEVELS[versionDiff]
  ) {
    return
  }

  // If the latest available version is greater than the user-defined version,
  // we generate a diagnostic suggesting a modification.
  if (gt(packageInfoChecked.versionLatest, packageVersion)) {
    const diagnostic = new Diagnostic(
      packageInfoChecked.versionRange,
      `Newer version of "${packageInfoChecked.name}" is available: ${packageInfoChecked.versionLatest}.`,
      DiagnosticSeverity.Warning
    )

    diagnostic.code = DIAGNOSTIC_ACTION + ":" + packageInfoChecked.name

    return diagnostic
  }

  // If the user-defined version is higher than the last available version,
  // then the user is probably using a pre-release version. In this case, we will only generate a informational diagnostic.
  if (gt(packageVersion, packageInfoChecked.versionLatest)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      `Version of "${packageInfoChecked.name}" is greater than latest version: ${packageInfoChecked.versionLatest}.`,
      DiagnosticSeverity.Information
    )
  }

  return
}

// Analyzes the document dependencies and returns the diagnostics.
export const generatePackagesDiagnostics = async (
  document: TextDocument,
  diagnosticsCollection: DiagnosticCollection
) => {
  // Read dependencies from package.json to get the name of packages used.
  const packagesInfos = Object.values(await getDocumentPackages(document))

  const documentDiagnostics = new DocumentDiagnostics(
    document,
    diagnosticsCollection
  )

  // Obtains, through NPM, the latest available version of each installed package.
  // As a result of each promise, we will have the package name and its latest version.
  for (const packageInfo of packagesInfos) {
    getPackageLatestVersion(packageInfo.name).then((versionLatest) => {
      const packageDiagnostic = getPackageDiagnostic({
        ...packageInfo,
        versionLatest,
      })

      if (packageDiagnostic) {
        documentDiagnostics.push(packageDiagnostic)
      }
    })
  }
}
