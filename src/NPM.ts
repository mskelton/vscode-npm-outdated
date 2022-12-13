import { exec } from "child_process"
import { coerce, maxSatisfying } from "semver"

import { Cache } from "./Cache"
import { PackageInfo } from "./Document"
import { getCacheLifetime, hasMajorUpdateProtection } from "./Settings"

const CACHE_PACKAGES: NPMViewResults = {}

// The `npm view` cache.
type NPMViewResults = Record<string, Cache<Promise<string[]>>>

// Get all package versions through `npm view` command.
const getPackageVersions = async (name: string) => {
  // If the package query is in the cache (even in the process of being executed), return it.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  if (CACHE_PACKAGES[name]?.isValid(getCacheLifetime())) {
    return CACHE_PACKAGES[name].value
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
      delete CACHE_PACKAGES[name]

      return reject()
    })
  )

  CACHE_PACKAGES[name] = new Cache(execPromise)

  return execPromise
}

// Get latest package available, respecting the major update protection, if need.
export const getPackageLatestVersion = async (
  packageInfo: PackageInfo
): Promise<string | null> => {
  const packageVersions = await getPackageVersions(packageInfo.name)

  // We captured the largest version currently available.
  const versionLatest = maxSatisfying(packageVersions, ">=0")

  // If protection is not enabled, we will return the latest available version, even if there is a major bump.
  // Otherwise, we will try to respect the user-defined version limit.
  if (!hasMajorUpdateProtection()) {
    return versionLatest
  }

  const versionClean = coerce(packageInfo.version)
  const versionSatisfying = maxSatisfying(packageVersions, `^${versionClean}`)

  // If the user-defined version is exactly the same version available within the range given by the user,
  // we may suggest the latest version, which may include a major bump.
  // Eg. { "package": "^5.1.3" } and latest is also "5.1.3".
  if (versionClean?.version === versionSatisfying) {
    return versionLatest
  }

  // Otherwise, we will suggest the latest version within the user's range first.
  return versionSatisfying
}
