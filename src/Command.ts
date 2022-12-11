import { exec } from "child_process"
import { dirname } from "path"

import { commands, OutputChannel, Uri, window, workspace } from "vscode"

export const COMMAND_INSTALL = "npm-outdated.install"
export const COMMAND_NOTIFY = "npm-outdated.notify"

type PackageManager = "npm" | "yarn"

const getPackageManager = async (uri: Uri): Promise<PackageManager> => {
  try {
    await workspace.fs.stat(
      Uri.file(uri.fsPath.replace("package.json", "yarn.lock"))
    )

    return "yarn"
  } catch (e) {
    return "npm"
  }
}

export const packageNotify = async (uri: Uri) => {
  const action = `Run "${await getPackageManager(uri)} install"`
  const result = await window.showInformationMessage(
    `Run your package manager install command to finish updating packages.`,
    action
  )

  if (result === action) {
    commands.executeCommand(
      COMMAND_INSTALL,
      `${await getPackageManager(uri)} install`,
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
      outputChannel.hide()

      window.showInformationMessage("Packages updated successfully!")
    } else {
      window.showErrorMessage(
        "Failed to update packages. Check the output console."
      )
    }
  })
}
