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
  COMMAND_INSTALL_REQUEST,
  packageInstall,
  packageInstallRequest,
} from "./Command"
import { diagnosticSubscribe, generatePackagesDiagnostics } from "./Diagnostic"
import { lazyCallback } from "./Utils"

export function activate(context: ExtensionContext): void {
  const diagnostics = languages.createDiagnosticCollection()

  diagnosticSubscribe(
    context,
    diagnostics,
    lazyCallback(async (document: TextDocument) => {
      await generatePackagesDiagnostics(document, diagnostics)
    }),
  )

  const outputChannel = window.createOutputChannel("npm Outdated")

  context.subscriptions.push(
    diagnostics,
    outputChannel,

    commands.registerCommand(COMMAND_INSTALL_REQUEST, packageInstallRequest),
    commands.registerCommand(
      COMMAND_INSTALL,
      packageInstall.bind(null, outputChannel),
    ),

    languages.registerCodeActionsProvider(
      { language: "json", pattern: "**/package.json", scheme: "file" },
      new PackageJsonCodeActionProvider(),
      { providedCodeActionKinds: [CodeActionKind.QuickFix] },
    ),
  )
}
