import {
  CodeActionKind,
  commands,
  ExtensionContext,
  languages,
  TextDocument,
  window,
} from "vscode"

import { PackageJsonCodeActionProvider } from "./CodeAction"
import {
  COMMAND_INSTALL,
  COMMAND_NOTIFY,
  packageInstall,
  packageNotify,
} from "./Command"
import { diagnosticSubscribe, reportDiagnostics } from "./Diagnostic"
import { getDocumentPackages } from "./Document"
import { getPackagesLatestVersions } from "./NPM"

export function activate(context: ExtensionContext) {
  const diagnostics = languages.createDiagnosticCollection("json")

  context.subscriptions.push(diagnostics)

  const outputChannel = window.createOutputChannel("npm Outdated")

  diagnosticSubscribe(context, diagnostics, async (document: TextDocument) => {
    const packagesLatestVersions = await getPackagesLatestVersions(
      document,
      outputChannel
    )

    if (!packagesLatestVersions) {
      return
    }

    const documentPackages = await getDocumentPackages(document)

    diagnostics.clear()
    diagnostics.set(
      document.uri,
      reportDiagnostics(packagesLatestVersions, documentPackages)
    )
  })

  context.subscriptions.push(
    outputChannel,

    commands.registerCommand(COMMAND_NOTIFY, packageNotify),
    commands.registerCommand(
      COMMAND_INSTALL,
      packageInstall.bind(null, outputChannel)
    ),

    languages.registerCodeActionsProvider(
      { language: "json", pattern: "**/package.json", scheme: "file" },
      new PackageJsonCodeActionProvider(),
      { providedCodeActionKinds: [CodeActionKind.QuickFix] }
    )
  )
}
