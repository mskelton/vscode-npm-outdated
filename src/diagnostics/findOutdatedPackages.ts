import vscode from "vscode"
import { getPackageInfo } from "./getPackageInfo"

interface Dependencies {
  [name: string]: string
}

interface PackageJson {
  dependencies?: Dependencies
  devDependencies?: Dependencies
}

export interface PackageResult {
  latestVersion?: string
  name: string
}

export async function findOutdatedPackages(
  doc: vscode.TextDocument
): Promise<PackageResult[]> {
  try {
    const packageJson = JSON.parse(doc.getText()) as PackageJson
    const packages: Dependencies = {
      ...packageJson.devDependencies,
      ...packageJson.dependencies,
    }

    const promises = Object.entries(packages).map(getPackageInfo)
    const results = await Promise.all(promises)

    return results.filter((result) => result.outdated)
  } catch (e) {
    return []
  }
}
