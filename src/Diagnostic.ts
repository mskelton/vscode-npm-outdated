import { sep } from "path"

import {
  coerce,
  diff,
  gt,
  maxSatisfying,
  prerelease,
  ReleaseType,
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
import {
  DocumentDecoration,
  DocumentDecorationManager,
} from "./DocumentDecoration"
import { DocumentDiagnostics } from "./DocumentDiagnostics"
import {
  getPackageLatestVersion,
  getPackagesInstalled,
  getPackageVersions,
} from "./NPM"
import { getLevel, getParallelProcessesLimit } from "./Settings"
import { promiseLimit, versionClear } from "./Utils"

const PACKAGE_JSON_PATH = `${sep}package.json`

const PACKAGE_NAME_REGEXP =
  /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*$/

const PACKAGE_VERSION_COMPLEX_REGEXP = /\s|\|\|/

const isPackageJsonDocument = (document: TextDocument) =>
  document.fileName.endsWith(PACKAGE_JSON_PATH)

export const diagnosticSubscribe = (
  context: ExtensionContext,
  diagnostics: DiagnosticCollection,
  onChange: (document: TextDocument) => void
): void => {
  // Handles the active editor change, but only continues with package.json files.
  const handleChange = (document: TextDocument): void => {
    if (isPackageJsonDocument(document)) {
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
    workspace.onDidCloseTextDocument((document: TextDocument) => {
      if (isPackageJsonDocument(document)) {
        diagnostics.delete(document.uri)

        DocumentDecorationManager.flushDocument(document)
      }
    })
  )
}

const PACKAGE_DIFF_LEVELS: Record<ReleaseType, number> = {
  major: 2,
  minor: 1,
  patch: 0,
  /** ignore */ premajor: -1,
  /** ignore */ preminor: -1,
  /** ignore */ prepatch: -1,
  /** ignore */ prerelease: -1,
}

export class PackageRelatedDiagnostic extends Diagnostic {
  public declare packageRelated: PackageInfoChecked

  public static is(
    diagnostic: PackageRelatedDiagnostic | Diagnostic
  ): diagnostic is PackageRelatedDiagnostic {
    return "packageRelated" in diagnostic
  }
}

export const getPackageDiagnostic = async (
  document: TextDocument,
  packageInfoChecked: PackageInfoChecked
): Promise<PackageRelatedDiagnostic | Diagnostic | undefined> => {
  // If the version specified by the user is not a valid range, it issues an error diagnostic.
  // Eg. { "package": "blah blah blah" }
  if (!validRange(packageInfoChecked.version)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      "Invalid package version.",
      DiagnosticSeverity.Error
    )
  }

  // When no latest version is found, we just ignore it.
  // In practice, this is an exception-of-the-exception, and is expected to never happen.
  if (!packageInfoChecked.versionLatest) {
    return
  }

  // Verify that the user-defined version is a released versions (including pre-releases).
  const packageVersions = await getPackageVersions(packageInfoChecked.name)

  if (!maxSatisfying(packageVersions, packageInfoChecked.version)) {
    const diagnostic = new PackageRelatedDiagnostic(
      packageInfoChecked.versionRange,
      "Invalid package version.",
      DiagnosticSeverity.Error
    )

    diagnostic.code = { target: document.uri, value: DIAGNOSTIC_ACTION }
    diagnostic.packageRelated = packageInfoChecked

    return diagnostic
  }

  // Normalizes the package version, through the informed range.
  // If the result is an invalid version, try to correct it via coerce().
  // Eg. "^3" (valid range, but "3" is a invalid version) => "3.0".
  let packageVersion = versionClear(packageInfoChecked.version)

  if (!valid(packageVersion)) {
    const packageVersionCoerced = coerce(packageVersion)

    if (!packageVersionCoerced) {
      return
    }

    packageVersion = packageVersionCoerced.version
  }

  const isPrerelease = prerelease(packageVersion) !== null

  if (!isPrerelease) {
    // Check if the version difference is compatible with what was configured by the user.
    // If the difference is less than the minimum configured then there is no need for a diagnostic.
    // Eg. "1.0 => 1.1" is a "minor" diff(). By default, we allow any non-prerelease diff() starting from "patch".
    // Pre-releases user-defined will always be recommended.
    const versionDiff = getLevel()
    const packageDiff = diff(packageInfoChecked.versionLatest, packageVersion)

    if (
      packageDiff &&
      versionDiff &&
      PACKAGE_DIFF_LEVELS[packageDiff] < PACKAGE_DIFF_LEVELS[versionDiff]
    ) {
      return
    }
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

  // If the user-defined version is higher than the last available version, then the user is probably using a pre-release version.
  // In this case, we will only generate a informational diagnostic.
  if (isPrerelease && gt(packageVersion, packageInfoChecked.versionLatest)) {
    return new Diagnostic(
      packageInfoChecked.versionRange,
      `Pre-release version of "${packageInfoChecked.name}".`,
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

  const packagesInstalled = getPackagesInstalled(document)

  const parallelProcessing = promiseLimit(getParallelProcessesLimit())

  // Obtains, through NPM, the latest available version of each installed package.
  // As a result of each promise, we will have the package name and its latest version.
  await Promise.all(
    packagesInfos.map((packageInfo) => {
      // Avoid packages with invalid names (usually typos).
      // Eg. "type script" instead of "typescript".
      if (!PACKAGE_NAME_REGEXP.test(packageInfo.name)) {
        return
      }

      // Ignores complex versions as it is difficult to understand user needs.
      // Eg. "^13 || ^14.5 || 15.6 - 15.7 || >=16.4 <17"
      if (PACKAGE_VERSION_COMPLEX_REGEXP.test(packageInfo.version)) {
        return
      }

      return parallelProcessing(async () => {
        documentDecorations.setCheckingMessage(
          packageInfo.versionRange.end.line
        )

        const versionLatest = await getPackageLatestVersion(packageInfo)
        const packageDiagnostic = await getPackageDiagnostic(document, {
          ...packageInfo,
          versionLatest: versionLatest ?? "",
        })

        if (packageDiagnostic !== undefined) {
          documentDiagnostics.push(packageDiagnostic)

          if (PackageRelatedDiagnostic.is(packageDiagnostic)) {
            return documentDecorations.setUpdateMessage(
              packageInfo.versionRange.end.line,
              packageDiagnostic,
              await packagesInstalled.catch(() => undefined)
            )
          }
        }

        documentDecorations.clearLine(packageInfo.versionRange.end.line)
      })
    })
  )

  documentDiagnostics.render()
}
