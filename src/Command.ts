import { exec } from "child_process"
import { dirname } from "path"

import { commands, OutputChannel, Uri, window } from "vscode"

export const COMMAND_INSTALL = "npm-outdated.install"
export const COMMAND_NOTIFY = "npm-outdated.notify"

export const packageNotify = async (uri: Uri) => {
  const packageManager: string = await commands.executeCommand(
    "npm.packageManager",
    uri
  )

  const action = `Run "${packageManager} install"`
  const result = await window.showInformationMessage(
    `Run your package manager install command to finish updating packages.`,
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

export const packageInstall = async (
  outputChannel: OutputChannel,
  command: string,
  cwd: string
) => {
  outputChannel.clear()
  outputChannel.show()
  outputChannel.append(`Updating selected packages...\n\n---\n`)

  const process = exec(command, { cwd })
  const handleData = (data: string) => outputChannel.append(data)

  let hasError = false

  process.stdout?.on?.("data", handleData)
  process.stderr?.on?.("data", (error: string) => {
    hasError = true

    handleData(error)
  })

  process.on("close", () => {
    outputChannel.append("\n---\n\nDone.\n\n")

    if (!hasError) {
      window.showInformationMessage("Packages updated successfully!")
    } else {
      window.showErrorMessage(
        "Failed to update packages. Check the output console."
      )
    }
  })
}
