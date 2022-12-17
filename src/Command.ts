import { exec } from "child_process"
import { dirname } from "path"

import { commands, l10n, OutputChannel, Uri, window } from "vscode"

export const COMMAND_INSTALL = "npm-outdated.install"
export const COMMAND_INSTALL_REQUEST = "npm-outdated.installRequest"

export const packageInstallRequest = async (uri: Uri): Promise<void> => {
  // @see https://github.com/microsoft/vscode/blob/main/extensions/npm/package.json
  const packageManager: string = await commands.executeCommand(
    "npm.packageManager",
    uri
  )

  const action = `Run "${packageManager} install"`
  const result = await window.showInformationMessage(
    l10n.t(
      "Run your package manager install command to finish updating packages."
    ),
    action
  )

  if (result === action) {
    commands.executeCommand(
      COMMAND_INSTALL,
      `${packageManager} install`,
      dirname(uri.fsPath)
    )
  }
}

export const packageInstall = (
  outputChannel: OutputChannel,
  command: string,
  cwd: string
): void => {
  outputChannel.clear()
  outputChannel.show()
  outputChannel.append(`${l10n.t("Installing selected packages...")}\n\n---\n`)

  const process = exec(command, { cwd })
  const handleData = (data: string): void => outputChannel.append(data)

  let hasError = false

  process.stdout?.on("data", handleData)
  process.stderr?.on("data", (error: string) => {
    hasError = true

    handleData(error)
  })

  process.on("close", () => {
    outputChannel.append(`\n---\n\n${l10n.t("Done.")}\n\n`)

    if (!hasError) {
      window.showInformationMessage(l10n.t("Packages installed successfully!"))
    } else {
      window.showErrorMessage(
        l10n.t("Failed to install packages. Check the output console.")
      )
    }
  })
}
