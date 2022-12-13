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
import { diagnosticSubscribe, generatePackagesDiagnostics } from "./Diagnostic"
import { lazyCallback } from "./Utils"

export function activate(context: ExtensionContext) {
  const diagnostics = languages.createDiagnosticCollection("json")

  diagnosticSubscribe(
    context,
    diagnostics,
    lazyCallback(async (document: TextDocument) => {
      await generatePackagesDiagnostics(document, diagnostics)
    })
  )

  const outputChannel = window.createOutputChannel("npm Outdated")

  context.subscriptions.push(
    diagnostics,
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
