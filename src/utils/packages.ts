import cp from "child_process"
import semverCoerce from "semver/functions/coerce"
import { PackageCache } from "../PackageCache"
import { PackageInfo } from "../models"

const regex = /"(.+)":\s*"(.+)"/
const cache = new PackageCache()

export function parsePackage(text: string) {
  const matches = text.match(regex)

  if (matches) {
    const [_, name, version] = matches

    return {
      name,
      version: semverCoerce(version)?.version,
    }
  }

  return {}
}

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
