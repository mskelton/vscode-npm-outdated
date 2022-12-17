import { exec } from "child_process"

import { workspace } from "vscode"

import { Cache } from "./Cache"
import { getCacheLifetime } from "./Settings"

// The `npm view` cache.
const CACHE_PACKAGES = new Map<string, Cache<Promise<string[]>>>()

// Get all package versions through `npm view` command.
export const getPackageVersions = async (name: string): Promise<string[]> => {
  // If the package query is in the cache (even in the process of being executed), return it.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  const cachePackages = CACHE_PACKAGES.get(name)

  if (cachePackages?.isValid(getCacheLifetime())) {
    return cachePackages.value
  }

  // Starts the `npm view` execution process.
  // The process is cached if it is triggered quickly, within lifetime.
  // @todo Make compatible with other package managers.
  const execPromise = new Promise<string[]>((resolve, reject) =>
    exec(`npm view --json ${name} versions`, (error, stdout) => {
      if (!error) {
        try {
          return resolve(JSON.parse(stdout))
        } catch (e) {
          /* empty */
        }
      }

      // In case of error or failure in processing the returned JSON,
      // we remove it from the cache and reject the Promise.
      CACHE_PACKAGES.delete(name)

      return reject()
    })
  )

  CACHE_PACKAGES.set(name, new Cache(execPromise))

  return execPromise
}

interface NPMListResponse {
  dependencies?: Record<string, { version: string }>
}

export let packagesInstalledCache:
  | Cache<Promise<PackagesInstalled | undefined>>
  | undefined

export type PackagesInstalled = Record<string, string | undefined>

// Returns packages installed by the user and their respective versions.
export const getPackagesInstalled = (): Promise<
  PackagesInstalled | undefined
> => {
  if (packagesInstalledCache?.isValid(60 * 60 * 1000)) {
    return packagesInstalledCache.value
  }

  const execPromise = new Promise<PackagesInstalled | undefined>((resolve) => {
    const cwd = workspace.workspaceFolders?.[0].uri.fsPath

    return exec("npm ls --json --depth=0", { cwd }, (_error, stdout) => {
      if (stdout) {
        try {
          const execResult = JSON.parse(stdout) as NPMListResponse

          if (execResult.dependencies) {
            // The `npm ls` command returns a lot of information.
            // We only need the name of the installed package and its version.
            const packageEntries = Object.entries(execResult.dependencies).map(
              ([packageName, packageInfo]) => [packageName, packageInfo.version]
            )

            return resolve(Object.fromEntries(packageEntries))
          }
        } catch (e) {
          /* empty */
        }
      }

      return resolve(undefined)
    })
  })

  packagesInstalledCache = new Cache(execPromise)

  return execPromise
}
