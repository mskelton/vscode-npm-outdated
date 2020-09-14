import vscode from "vscode"
import { PackageJsonCodeActionProvider } from "./PackageJsonCodeActionProvider"

export function activate(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      {
        language: "json",
        pattern: "**/package.json",
        scheme: "file",
      },
      new PackageJsonCodeActionProvider()
    )
  )
}
