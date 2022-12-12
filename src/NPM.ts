import { exec } from "child_process"
import { OutputChannel, TextDocument } from "vscode"

import { getCacheLifetime } from "./Settings"
import { isPromiseResolved } from "./Utils"

const CACHE_PACKAGES: NPMViewResultCacheInterface = {}

interface NPMViewResultCacheInterface {
  [packageName: string]: {
    // Date.now() of last `npm view` run.
    checkedAt: number

    // The cached `npm view` result.
    execPromise: Promise<string>
  }
}

// Response of `npm view` command.
interface NPMViewResultInterface {
  // Version based on dist-tags (more reliable).
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "dist-tags.latest"?: string

  // Version based on package.json from the target package (dev-dependent, less reliable).
  version: string
}

// Get the latest version of a package through NPM.
export const getPackageLatestVersion = async (name: string) => {
  if (CACHE_PACKAGES[name]?.checkedAt >= Date.now() - getCacheLifetime()) {
    return CACHE_PACKAGES[name].execPromise
  }

  const execPromise = new Promise<string>((resolve, reject) =>
    exec(
      `npm view --json ${name} dist-tags.latest version`,
      (error, stdout) => {
        if (error) {
          return reject()
        }

        try {
          const viewResult: NPMViewResultInterface = JSON.parse(stdout)

          resolve(viewResult["dist-tags.latest"] ?? viewResult.version)
        } catch (e) {
          return reject()
        }
      }
    )
  )

  CACHE_PACKAGES[name] = {
    checkedAt: Date.now(),
    execPromise,
  }

  return execPromise
}

// Final response to the process of getting the latest version of a package,
export interface PackageInterface {
  // Package latest version.
  latestVersion: string

  // Package name.
  name: string
}

// Analyzes the document dependencies and returns the latest versions.
export const getPackagesLatestVersions = async (
  document: TextDocument,
  outputChannel: OutputChannel
): Promise<Record<string, PackageInterface> | undefined> => {
  try {
    const packageJson = JSON.parse(document.getText())

    // Read dependencies from package.json to get the name of packages used.
    // For now, the user-defined version is irrelevant.
    const packageDependencies: PackageInterface = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
      },
      packagesNames = Object.keys(packageDependencies)

    if (!packagesNames.length) {
      return
    }

    outputChannel.appendLine(
      `Reading packages latest versions of ${packagesNames.length} packages.`
    )

    // Obtains, through NPM, the latest available version of each installed package.
    // As a result of each promise, we will have the package name and its latest version.
    const packagesPromises = packagesNames.map(
      (name) =>
        new Promise<PackageInterface>((resolve, reject) =>
          getPackageLatestVersion(name)
            .then((latestVersion) => resolve({ latestVersion, name }))
            .catch(reject)
        )
    )

    // As a result, we will have an object whose key is the package name and the value is the package additional data (including the latest version).
    return Object.fromEntries(
      (await Promise.allSettled(packagesPromises))
        .filter(isPromiseResolved)
        .map((result) => [result.value.name, result.value])
    )
  } catch (e) {
    return
  }
}
