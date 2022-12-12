import { commands, DocumentSymbol, Position, Range, TextDocument } from "vscode"

// Identifies a document package.
interface DocumentPackage {
  // Package name.
  name: string

  // The package range.
  range: Range

  // The package current version (user-defined).
  version: string

  // The package version range only.
  versionRange: Range
}

// Process packages of a certain dependency type (eg from "dependencies" and "devDependencies").
// Returns existing packages, their versions and the package range.
const mapDependencyRange = (
  documentSymbol: DocumentSymbol | undefined
): DocumentPackage[] => {
  if (!documentSymbol || documentSymbol.children.length === 0) {
    return []
  }

  return documentSymbol.children.map(
    (child): DocumentPackage => ({
      name: child.name,
      range: child.range,
      version: child.detail,
      versionRange: new Range(
        new Position(
          child.range.end.line,
          child.range.end.character - 1 - child.detail.length
        ),
        new Position(child.range.end.line, child.range.end.character - 1)
      ),
    })
  )
}

export interface DocumentsPackagesInterface {
  [packageName: string]: DocumentPackage
}

// Gets an array of packages used in the document, regardless of dependency type.
export const getDocumentPackages = async (
  document: TextDocument
): Promise<DocumentsPackagesInterface> => {
  const symbols: DocumentSymbol[] = await commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    ),
    symbolDependencies = symbols.find(
      (symbol) => symbol.name === "dependencies"
    ),
    symbolDevDependencies = symbols.find(
      (symbol) => symbol.name === "devDependencies"
    )

  return Object.fromEntries(
    [
      ...mapDependencyRange(symbolDependencies),
      ...mapDependencyRange(symbolDevDependencies),
    ].map((documentPackage) => [documentPackage.name, documentPackage])
  )
}
