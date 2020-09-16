import vscode from "vscode"
import { parseDependency } from "../utils/parseDependency"

const isDependencyBlock = (line: vscode.TextLine) =>
  line.text.includes('"dependencies"') ||
  line.text.includes('"devDependencies"')

export function getPackageRanges(doc: vscode.TextDocument) {
  let inDependencyBlock = false
  const ranges: Record<string, vscode.Range> = {}

  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i)

    if (line.text.includes("}")) {
      inDependencyBlock = false
    }

    if (inDependencyBlock) {
      const { name, version } = parseDependency(line.text)

      if (name && version) {
        const startIndex = line.text.indexOf(version)

        ranges[name] = new vscode.Range(
          line.lineNumber,
          startIndex,
          line.lineNumber,
          startIndex + version.length
        )
      }
    }

    if (isDependencyBlock(line)) {
      inDependencyBlock = true
    }
  }

  return ranges
}
