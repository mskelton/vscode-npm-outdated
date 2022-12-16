import { sep } from "path"

import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  l10n,
  Range,
  TextDocument,
  TextDocumentChangeEvent,
  TextEditor,
  window,
  workspace,
} from "vscode"

import { DIAGNOSTIC_ACTION } from "./CodeAction"
import { getDocumentPackages } from "./Document"
import {
  DocumentDecoration,
  DocumentDecorationManager,
} from "./DocumentDecoration"
import { DocumentDiagnostics } from "./DocumentDiagnostics"
import { packagesInstalledCache } from "./NPM"
import { PackageInfo } from "./PackageInfo"
import { getParallelProcessesLimit } from "./Settings"
import { promiseLimit } from "./Utils"

const PACKAGE_JSON_PATH = `${sep}package.json`

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

  // Trigger when any file in the workspace is modified.
  // Our interest here is to know about package-lock.json.
  context.subscriptions.push(
    workspace
      .createFileSystemWatcher("**/package-lock.json")
      .onDidChange(() => {
        packagesInstalledCache?.invalidate()

        window.visibleTextEditors.forEach((editor) =>
          handleChange(editor.document)
        )
      })
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

export class PackageRelatedDiagnostic extends Diagnostic {
  constructor(
    range: Range,
    message: string,
    severity: DiagnosticSeverity,
    document: TextDocument,
    public packageRelated: PackageInfo
  ) {
    super(range, message, severity)

    this.code = { target: document.uri, value: DIAGNOSTIC_ACTION }
  }

  public static is(
    diagnostic: PackageRelatedDiagnostic | Diagnostic
  ): diagnostic is PackageRelatedDiagnostic {
    return "packageRelated" in diagnostic
  }
}

export const getPackageDiagnostic = async (
  document: TextDocument,
  packageInfo: PackageInfo
): Promise<PackageRelatedDiagnostic | Diagnostic | undefined> => {
  if (!packageInfo.isVersionValidRange()) {
    return new Diagnostic(
      packageInfo.versionRange,
      l10n.t("Invalid package version."),
      DiagnosticSeverity.Error
    )
  }

  const versionLatest = await packageInfo.getVersionLatest()

  // When no latest version is found, we just ignore it.
  // In practice, this is an exception-of-the-exception, and is expected to never happen.
  if (!versionLatest) {
    return
  }

  if (!packageInfo.isVersionReleased()) {
    return new PackageRelatedDiagnostic(
      packageInfo.versionRange,
      l10n.t("Package version not available."),
      DiagnosticSeverity.Error,
      document,
      packageInfo
    )
  }

  if (!packageInfo.isInstalled()) {
    return new PackageRelatedDiagnostic(
      packageInfo.versionRange,
      l10n.t(
        'Package "{0}" pending installation: {1}.',
        packageInfo.name,
        versionLatest
      ),
      DiagnosticSeverity.Warning,
      document,
      packageInfo
    )
  }

  if (!packageInfo.isVersionUpgradable()) {
    return
  }

  if (!(await packageInfo.isVersionMaxed())) {
    return new PackageRelatedDiagnostic(
      packageInfo.versionRange,
      l10n.t(
        'Newer version of "{0}" is available: {1}.',
        packageInfo.name,
        versionLatest
      ),
      DiagnosticSeverity.Warning,
      document,
      packageInfo
    )
  }

  // If the user-defined version is higher than the last available version, then the user is probably using a pre-release version.
  // In this case, we will only generate a informational diagnostic.
  if (packageInfo.isVersionPrerelease()) {
    return new Diagnostic(
      packageInfo.versionRange,
      l10n.t('Pre-release version of "{0}".', packageInfo.name),
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

  const parallelProcessing = promiseLimit(getParallelProcessesLimit())

  // Obtains, through NPM, the latest available version of each installed package.
  // As a result of each promise, we will have the package name and its latest version.
  await Promise.all(
    packagesInfos.map((packageInfo) => {
      if (!packageInfo.isNameValid()) {
        return
      }

      if (packageInfo.isVersionComplex()) {
        return
      }

      return parallelProcessing(async () => {
        documentDecorations.setCheckingMessage(packageInfo.getLine())

        const packageDiagnostic = await getPackageDiagnostic(
          document,
          packageInfo
        )

        if (packageDiagnostic !== undefined) {
          documentDiagnostics.push(packageDiagnostic)

          if (PackageRelatedDiagnostic.is(packageDiagnostic)) {
            return documentDecorations.setUpdateMessage(
              packageInfo.getLine(),
              packageDiagnostic
            )
          }
        }

        documentDecorations.clearLine(packageInfo.getLine())
      })
    })
  )

  documentDiagnostics.render()
}
