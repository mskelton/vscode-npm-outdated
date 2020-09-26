import cp from "child_process"
import vscode from "vscode"

export const install = (outputChannel: vscode.OutputChannel) => async (
  cmd: string,
  cwd: string
) => {
  outputChannel.clear()

  const p = cp.exec(cmd, { cwd })
  const handleData = (data: string) => outputChannel.append(data)

  p.stderr?.on?.("data", handleData)
  p.stdout?.on?.("data", handleData)

  outputChannel.show()
}
