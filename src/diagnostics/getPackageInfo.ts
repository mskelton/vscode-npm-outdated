import semverCoerce from "semver/functions/coerce"
import semverDiff from "semver/functions/diff"
import { workspace } from 'vscode';
import { fetchPackage } from "../utils/packages"

export async function getPackageInfo([name, version]: string[]) {
  const info = await fetchPackage(name)
  const localVersion = semverCoerce(version)
  const versionToCompare = workspace.getConfiguration().get<string>('npm-outdated.version')
  const versionDiff = info && localVersion && semverDiff(info.version, localVersion)

  const versionMap: Record<string, number> = {
    major: 2,
    minor: 1,
    patch: 0
  }

  return {
    latestVersion: info?.version,
    name,
    outdated: versionDiff && versionToCompare && (versionMap[versionDiff] >= versionMap[versionToCompare]),
  }
}
