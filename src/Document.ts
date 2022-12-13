import {
  commands,
  Diagnostic,
  DocumentSymbol,
  Position,
  Range,
  TextDocument,
} from "vscode"

// The package info, based on user-document.
export interface PackageInfo {
  // Package name.
  name: string

  // The package range.
  range: Range

  // The package current version (user-defined).
  version: string

  // The package version range only.
  versionRange: Range
}

// The package info after it being checked for update.
export interface PackageInfoChecked extends PackageInfo {
  // The package latest version.
  versionLatest: string
}

// The package diagnostic.
export interface PackageDiagnostic {
  // Package diagnostic.
  diagnostic: Diagnostic | null

  // Package info.
  documentPackage: PackageInfo
}

// Process packages of a certain dependency type (eg from "dependencies" and "devDependencies").
// Returns existing packages, their versions and the package range.
const mapDependencyRange = (
  documentSymbol: DocumentSymbol | undefined
): PackageInfo[] => {
  if (!documentSymbol || documentSymbol.children.length === 0) {
    return []
  }

  return documentSymbol.children.map(
    (child): PackageInfo => ({
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
  [packageName: string]: PackageInfo
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
