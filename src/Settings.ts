import { ReleaseType } from "semver"
import { workspace } from "vscode"

export const getCacheLifetime = () => {
  return workspace
    .getConfiguration()
    .get<number>("npm-outdated.cacheLifetime") as number
}

export const getLevel = () => {
  return workspace.getConfiguration().get<ReleaseType>("npm-outdated.level")
}
