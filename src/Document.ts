import { commands, DocumentSymbol, Range, TextDocument } from "vscode"
import { PackageInfo } from "./PackageInfo"
import { waitUntil } from "./Utils"

// Process packages of a certain dependency type (eg from "dependencies" and "devDependencies").
// Returns existing packages, their versions and the package range.
const mapDependencyRange = (
  document: TextDocument,
  documentSymbol: DocumentSymbol | undefined,
): PackageInfo[] => {
  if (!documentSymbol || documentSymbol.children.length === 0) {
    return []
  }

  return documentSymbol.children.map(
    (child) =>
      new PackageInfo(
        document,
        child.name,
        child.range,
        child.detail,
        new Range(
          child.range.end.line,
          child.range.end.character - 1 - child.detail.length,
          child.range.end.line,
          child.range.end.character - 1,
        ),
      ),
  )
}

export type DocumentsPackagesInterface = Record<string, PackageInfo>

// Gets an array of packages used in the document, regardless of dependency type.
export const getDocumentPackages = async (
  document: TextDocument,
): Promise<DocumentsPackagesInterface> => {
  let symbols: DocumentSymbol[] | undefined

  await waitUntil(async () => {
    symbols = await commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      document.uri,
    )

    return symbols !== undefined
  }, 33)

  const symbolDependencies = symbols?.find(
      (symbol) => symbol.name === "dependencies",
    ),
    symbolDevDependencies = symbols?.find(
      (symbol) => symbol.name === "devDependencies",
    )

  return Object.fromEntries(
    [
      ...mapDependencyRange(document, symbolDependencies),
      ...mapDependencyRange(document, symbolDevDependencies),
    ].map((documentPackage) => [documentPackage.name, documentPackage]),
  )
}
