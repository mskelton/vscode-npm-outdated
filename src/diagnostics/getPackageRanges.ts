import vscode from "vscode"

const isDependencyBlock = (line: vscode.TextLine) =>
  line.text.includes('"dependencies"') ||
  line.text.includes('"devDependencies"')

const getPackageName = (text: string) => {
  return text.match(/"(.+)":/)?.[1]
}

export function getPackageRanges(doc: vscode.TextDocument) {
  let inDependencyBlock = false
  const ranges: Record<string, vscode.Range> = {}

  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i)

    if (line.text.includes("}")) {
      inDependencyBlock = false
    }

    if (inDependencyBlock) {
      const packageName = getPackageName(line.text)

      if (packageName) {
        const startIndex = line.text.indexOf(packageName)

        ranges[packageName] = new vscode.Range(
          line.lineNumber,
          startIndex,
          line.lineNumber,
          startIndex + packageName.length
        )
      }
    }

    if (isDependencyBlock(line)) {
      inDependencyBlock = true
    }
  }

  return ranges
}
