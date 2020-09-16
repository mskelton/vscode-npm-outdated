import semverCoerce from "semver/functions/coerce"
import semverGt from "semver/functions/gt"
import { fetchPackage } from "../utils/packages"

export async function getPackageInfo([name, version]: string[]) {
  const info = await fetchPackage(name)
  const localVersion = semverCoerce(version)

  return {
    latestVersion: info?.version,
    name,
    outdated: info && localVersion && semverGt(info.version, localVersion),
  }
}
