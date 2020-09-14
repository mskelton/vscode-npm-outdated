import semverCoerce from "semver/functions/coerce"
import { PackageInfo } from "../models"
import { getRegistryUrl } from "./getRegistryUrl"
import { request } from "./request"

const regex = /"(.+)":\s*"(.+)"/

export function parsePackage(text: string): Partial<PackageInfo> {
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
  const registryUrl = getRegistryUrl()
  const url = `${registryUrl}/${name}/latest`

  return await request<PackageInfo>(url)
}
