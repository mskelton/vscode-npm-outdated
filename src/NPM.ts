import { exec } from "child_process"

import { prerelease } from "semver"
import { workspace } from "vscode"

import { Cache } from "./Cache"
import { PackageInfo } from "./PackageInfo"
import { getCacheLifetime } from "./Settings"
import { cacheEnabled, fetchLite } from "./Utils"

type PackagesVersions = Map<string, Cache<Promise<string[] | null>>>

// The `npm view` cache.
const packagesCache: PackagesVersions = new Map()

// Get all package versions through `npm view` command.
export const getPackageVersions = async (
  name: string
): Promise<string[] | null> => {
  // If the package query is in the cache (even in the process of being executed), return it.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  if (cacheEnabled()) {
    const cachePackages = packagesCache.get(name)

    if (cachePackages?.isValid(getCacheLifetime())) {
      return cachePackages.value
    }
  }

  // Starts the `npm view` execution process.
  // The process is cached if it is triggered quickly, within lifetime.
  // @todo Make compatible with other package managers.
  const execPromise = new Promise<string[] | null>((resolve) =>
    exec(`npm view --json ${name} versions`, (error, stdout) => {
      if (!error) {
        try {
          return resolve(JSON.parse(stdout))
        } catch (e) {
          /* empty */
        }
      }

      // In case of error or failure in processing the returned JSON,
      // we remove it from the cache and resolve as null.
      packagesCache.delete(name)

      return resolve(null)
    })
  )

  packagesCache.set(name, new Cache(execPromise))

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
  if (cacheEnabled() && packagesInstalledCache?.isValid(60 * 60 * 1000)) {
    return packagesInstalledCache.value
  }

  const execPromise = new Promise<PackagesInstalled | undefined>((resolve) => {
    const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath

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

export interface PackageAdvisory {
  cvss: { score: number }
  severity: string
  title: string
  url: string
  vulnerable_versions: string
}

export type PackagesAdvisories = Map<string, PackageAdvisory[]>

const packagesAdvisoriesCache = new Map<string, Cache<PackageAdvisory[]>>()

// Returns packages with known security advisories.
export const getPackagesAdvisories = async (
  packagesInfos: PackageInfo[]
): Promise<PackagesAdvisories | undefined> => {
  const packages: Record<string, string[]> = {}

  for (const packageInfo of packagesInfos) {
    if (packageInfo.name) {
      // If already cached, so we keep the latest results.
      // As it is already stored, then we ignore this package from the next fetch.
      if (
        !packageInfo.isNameValid() ||
        packageInfo.isVersionComplex() ||
        packagesAdvisoriesCache
          .get(packageInfo.name)
          ?.isValid(getCacheLifetime())
      ) {
        continue
      }

      // We need to push all versions to the NPM Registry.
      // Thus, we can check in real time when the package version is modified by the user.
      const packageVersions = await getPackageVersions(packageInfo.name)

      // Add to be requested.
      if (packageVersions) {
        packages[packageInfo.name] = packageVersions.filter(
          (packageVersion) => prerelease(packageVersion) === null
        )
      }
    }
  }

  if (Object.keys(packages).length) {
    // Query advisories through the NPM Registry.
    const responseAdvisories = await fetchLite<PackagesAdvisories | undefined>(
      "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
      packages
    )

    // Fills the packages with their respective advisories.
    if (responseAdvisories) {
      Object.entries(responseAdvisories).forEach(
        ([packageName, packageAdvisories]) =>
          packagesAdvisoriesCache.set(
            packageName,
            new Cache(packageAdvisories as PackageAdvisory[])
          )
      )
    }

    // Autocomplete packages without any advisories.
    Object.keys(packages).forEach((packageName) => {
      if (!packagesAdvisoriesCache.has(packageName)) {
        packagesAdvisoriesCache.set(packageName, new Cache([]))
      }
    })
  }

  return new Map(
    Array.from(packagesAdvisoriesCache.entries()).map(
      ([packageName, packageAdvisory]) => [packageName, packageAdvisory.value]
    )
  )
}
