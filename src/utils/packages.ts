import cp from "child_process"
import { PackageCache } from "../PackageCache"
import { PackageInfo } from "../models"

const cache = new PackageCache()

function npmView(name: string): Promise<PackageInfo | undefined> {
  const command = `npm view --json ${name} dist-tags.latest version`

  return new Promise((resolve, _reject) => {
    cp.exec(command, (error, stdout) => {
      if (error) {
        return resolve(undefined)
      }

      try {
        const content = JSON.parse(stdout)

        resolve({
          name,
          version: content["dist-tags.latest"] || content["version"],
        })
      } catch (e) {
        resolve(undefined)
      }
    })
  })
}

export async function fetchPackage(name: string) {
  const cacheItem = cache.get(name)
  if (cacheItem) {
    return cacheItem
  }

  const info = await npmView(name)
  if (info) {
    cache.set(info)
    return info
  }
}
