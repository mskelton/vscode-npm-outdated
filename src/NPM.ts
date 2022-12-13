import { exec } from "child_process"

import { getCacheLifetime } from "./Settings"

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
  // If the package is in cache (even in the process of being executed), return it if possible.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  if (CACHE_PACKAGES[name]?.checkedAt >= Date.now() - getCacheLifetime()) {
    return CACHE_PACKAGES[name].execPromise
  }

  // Starts the `npm view` execution process.
  // The process is cached if it is triggered quickly, within lifetime.
  // @todo Make compatible with other package managers.
  const execPromise = new Promise<string>((resolve, reject) =>
    exec(
      `npm view --json ${name} dist-tags.latest version`,
      (error, stdout) => {
        if (!error) {
          try {
            const viewResult: NPMViewResultInterface = JSON.parse(stdout)

            return resolve(viewResult["dist-tags.latest"] ?? viewResult.version)
          } catch (e) {
            /* empty */
          }
        }

        // In case of error or failure in processing the returned JSON,
        // we remove it from the cache and reject the Promise.
        delete CACHE_PACKAGES[name]

        return reject()
      }
    )
  )

  CACHE_PACKAGES[name] = {
    checkedAt: Date.now(),
    execPromise,
  }

  return execPromise
}
