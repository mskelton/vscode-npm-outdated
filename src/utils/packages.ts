import semverCoerce from "semver/functions/coerce"
import { PackageCache } from "../PackageCache"
import { PackageInfo } from "../models"
import { getRegistryUrl } from "./getRegistryUrl"
import { request } from "./request"

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

export async function fetchPackage(name: string) {
  const cacheItem = cache.get(name)

  if (cacheItem) {
    return cacheItem
  }

  const registryUrl = getRegistryUrl()
  const url = `${registryUrl}/${name}/latest`
  const info = await request<PackageInfo>(url)

  cache.set(info)
  return info
}
