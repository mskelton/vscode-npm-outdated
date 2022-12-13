import { ReleaseType } from "semver"
import { workspace } from "vscode"

export const getCacheLifetime = () => {
  return (
    Number(
      workspace.getConfiguration().get<number>("npm-outdated.cacheLifetime")
    ) *
    60 *
    1000
  )
}

export const getLevel = () => {
  return workspace.getConfiguration().get<ReleaseType>("npm-outdated.level")
}
