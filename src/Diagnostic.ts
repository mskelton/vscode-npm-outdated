import { sep } from "path"

import { coerce, diff, gt, ReleaseType, SemVer, validRange } from "semver"

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
import { DocumentDecoration } from "./DocumentDecoration"
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

export class PackageRelatedDiagnostic extends Diagnostic {
  public declare packageRelated: PackageInfoChecked

  public static is(
    diagnostic: PackageRelatedDiagnostic | Diagnostic
  ): diagnostic is PackageRelatedDiagnostic {
    return "packageRelated" in diagnostic
  }
}

export const getPackageDiagnostic = (
  document: TextDocument,
  packageInfoChecked: PackageInfoChecked
): PackageRelatedDiagnostic | Diagnostic | undefined => {
  // If the version specified by the user is not a valid range, it issues an error diagnostic.
  // Eg. { "package": "blah blah blah" }
  if (!validRange(packageInfoChecked.version)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      "Invalid package version.",
      DiagnosticSeverity.Error
    )
  }

  const packageVersion = coerce(packageInfoChecked.version) as SemVer

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
    const diagnostic = new PackageRelatedDiagnostic(
      packageInfoChecked.versionRange,
      `Newer version of "${packageInfoChecked.name}" is available: ${packageInfoChecked.versionLatest}.`,
      DiagnosticSeverity.Warning
    )

    diagnostic.code = { target: document.uri, value: DIAGNOSTIC_ACTION }
    diagnostic.packageRelated = packageInfoChecked

    return diagnostic
  }

  // If the user-defined version is higher than the last available version,
  // then the user is probably using a pre-release version. In this case, we will only generate a informational diagnostic.
  if (gt(packageVersion, packageInfoChecked.versionLatest)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      `Version of "${packageInfoChecked.name}" is greater than latest release: ${packageInfoChecked.versionLatest}.`,
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

  const documentDecorations = new DocumentDecoration(document)
  const documentDiagnostics = new DocumentDiagnostics(
    document,
    diagnosticsCollection
  )

  // Obtains, through NPM, the latest available version of each installed package.
  // As a result of each promise, we will have the package name and its latest version.
  await Promise.all(
    packagesInfos.map((packageInfo) => {
      documentDecorations.setCheckingMessage(packageInfo.versionRange.end.line)

      return getPackageLatestVersion(packageInfo.name).then((versionLatest) => {
        const packageDiagnostic = getPackageDiagnostic(document, {
          ...packageInfo,
          versionLatest,
        })

        if (packageDiagnostic !== undefined) {
          documentDiagnostics.push(packageDiagnostic)

          if (PackageRelatedDiagnostic.is(packageDiagnostic)) {
            documentDecorations.setUpdateMessage(
              packageInfo.versionRange.end.line,
              packageDiagnostic
            )
          }
        }

        if (
          !packageDiagnostic ||
          packageDiagnostic.severity === DiagnosticSeverity.Information
        ) {
          documentDecorations.clearLine(packageInfo.versionRange.end.line)
        }
      })
    })
  )
}
