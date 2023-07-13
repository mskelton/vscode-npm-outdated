import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname } from "node:path"
import { prerelease } from "semver"
import { TextDocument } from "vscode"
import { Cache } from "./Cache"
import { PackageInfo } from "./PackageInfo"
import { getCacheLifetime } from "./Settings"
import { cacheEnabled, fetchLite } from "./Utils"

const PACKAGE_VERSION_REGEXP = /^\d+\.\d+\.\d+$/

type PackagesVersions = Map<string, Cache<Promise<string[] | null>>>

export const enum PackageManager {
  NPM,
  PNPM,
  NONE,
}

interface NPMRegistryPackage {
  versions?: Record<string, unknown>
}

// The `npm view` cache.
const packagesCache: PackagesVersions = new Map()

// Get all package versions through `npm view` command.
export const getPackageVersions = async (
  name: string,
): Promise<string[] | null> => {
  // If the package query is in the cache (even in the process of being executed), return it.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  if (cacheEnabled()) {
    const cachePackages = packagesCache.get(name)

    if (cachePackages?.isValid(getCacheLifetime())) {
      return cachePackages.value
    }
  }

  // We'll use Registry NPM to get the versions directly from the source.
  // This avoids loading processes via `npm view`.
  // The process is cached if it is triggered quickly, within lifetime.
  const execPromise = new Promise<string[] | null>((resolve) =>
    fetchLite<NPMRegistryPackage>({
      url: `https://registry.npmjs.org/${name}`,
    }).then((data) => {
      if (data?.versions) {
        return resolve(Object.keys(data.versions))
      }

      // Uses `npm view` as a fallback.
      // This usually happens when the package needs authentication.
      // In this case, we'll let `npm` handle it directly.
      return exec(`npm view --json ${name} versions`, (error, stdout) => {
        if (!error) {
          try {
            return resolve(JSON.parse(stdout))
          } catch (e) {
            /* empty */
          }
        }

        return resolve(null)
      })
    }),
  )

  packagesCache.set(name, new Cache(execPromise))

  return execPromise
}

type NPMDependencies = Record<string, { version: string }>

interface NPMListResponse {
  dependencies?: NPMDependencies
  devDependencies?: NPMDependencies
  peerDependencies?: NPMDependencies
}

export type PackagesInstalled = Record<string, string | undefined>

const packageManagerExecCache = new Cache<Record<string, boolean>>({})

// Return if asked Package Manager is installed.
const supportsPackageManager = async (
  document: TextDocument,
  cmd: "npm" | "pnpm",
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (
      cacheEnabled() &&
      packageManagerExecCache.isValid(getCacheLifetime()) &&
      cmd in packageManagerExecCache.value
    ) {
      resolve(packageManagerExecCache.value[cmd]!)
      return
    }

    const cwd = dirname(document.uri.fsPath)

    exec(`${cmd} --version`, { cwd }, (error, stdout) => {
      const isInstalled =
        !error && PACKAGE_VERSION_REGEXP.test(stdout.trimEnd())

      packageManagerExecCache.value[cmd] = isInstalled

      resolve(isInstalled)
    })
  })
}

export const packageManagerCaches = new Map<
  string,
  Cache<PackageManager | undefined>
>()

// Return the current Package Manager.
export const getPackageManager = async (
  document: TextDocument,
): Promise<PackageManager> => {
  const cwd = dirname(document.uri.fsPath)

  if (cacheEnabled()) {
    const packageManagerCache = packageManagerCaches.get(cwd)

    if (
      packageManagerCache?.value &&
      packageManagerCache.isValid(getCacheLifetime())
    ) {
      return packageManagerCache.value!
    }
  }

  let packageManager: PackageManager

  // Using PNPM with already installed node_modules/ directory.
  if (
    existsSync(`${cwd}/node_modules/.pnpm`) &&
    (await supportsPackageManager(document, "pnpm"))
  ) {
    packageManager = PackageManager.PNPM
  }
  // Not installed node_modules/ but pnpm-lock.yaml is present.
  else if (
    existsSync(`${cwd}/pnpm-lock.yaml`) &&
    (await supportsPackageManager(document, "pnpm"))
  ) {
    packageManager = PackageManager.PNPM
  }
  // In last case, check for NPM.
  else if (await supportsPackageManager(document, "npm")) {
    packageManager = PackageManager.NPM
  }
  // None available Package Manager supported.
  else {
    packageManager = PackageManager.NONE
  }

  packageManagerCaches.set(cwd, new Cache(packageManager))

  return packageManager
}

const getPackagesInstalledEntries = (
  packages: NPMListResponse,
): PackagesInstalled | null => {
  const dependencies: NPMDependencies = {
    ...(packages.dependencies ?? {}),
    ...(packages.devDependencies ?? {}),
  }

  if (Object.keys(dependencies).length) {
    // The `npm ls` command returns a lot of information.
    // We only need the name of the installed package and its version.
    const packageEntries = Object.entries(dependencies).map(
      ([packageName, packageInfo]) => [packageName, packageInfo.version],
    )

    return Object.fromEntries(packageEntries)
  }

  return null
}

export const packagesInstalledCaches = new Map<
  string,
  Cache<Promise<PackagesInstalled | undefined>>
>()

// Returns packages installed by the user and their respective versions.
export const getPackagesInstalled = async (
  document: TextDocument,
): Promise<PackagesInstalled | undefined> => {
  const cwd = dirname(document.uri.fsPath)

  if (cacheEnabled()) {
    const cache = packagesInstalledCaches.get(cwd)

    if (cache?.isValid(60 * 60 * 1000)) {
      return cache.value
    }
  }

  const packageManager = await getPackageManager(document)

  const execPromise = new Promise<PackagesInstalled | undefined>((resolve) => {
    if (packageManager === PackageManager.PNPM) {
      return exec("pnpm ls --json --depth=0", { cwd }, (_error, stdout) => {
        if (stdout) {
          try {
            const execResult = JSON.parse(stdout) as [NPMListResponse]

            if (Array.isArray(execResult)) {
              const packagesInstalled = getPackagesInstalledEntries(
                execResult[0],
              )

              if (packagesInstalled !== null) {
                return resolve(packagesInstalled)
              }
            }
          } catch (e) {
            /* empty */
          }
        }

        return resolve(undefined)
      })
    }

    return exec("npm ls --json --depth=0", { cwd }, (_error, stdout) => {
      if (stdout) {
        try {
          const packagesInstalled = getPackagesInstalledEntries(
            JSON.parse(stdout),
          )

          if (packagesInstalled !== null) {
            return resolve(packagesInstalled)
          }
        } catch (e) {
          /* empty */
        }
      }

      return resolve(undefined)
    })
  })

  packagesInstalledCaches.set(cwd, new Cache(execPromise))

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
  packagesInfos: PackageInfo[],
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
          (packageVersion) => prerelease(packageVersion) === null,
        )
      }
    }
  }

  if (Object.keys(packages).length) {
    // Query advisories through the NPM Registry.
    const responseAdvisories = await fetchLite<PackagesAdvisories | undefined>({
      body: packages,
      method: "post",
      url: "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
    })

    // Fills the packages with their respective advisories.
    if (responseAdvisories) {
      Object.entries(responseAdvisories).forEach(
        ([packageName, packageAdvisories]) =>
          packagesAdvisoriesCache.set(
            packageName,
            new Cache(packageAdvisories as PackageAdvisory[]),
          ),
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
      ([packageName, packageAdvisory]) => [packageName, packageAdvisory.value],
    ),
  )
}
