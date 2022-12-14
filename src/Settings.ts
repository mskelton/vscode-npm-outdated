import { ReleaseType } from "semver"
import { workspace } from "vscode"

// Minimum semver bump required for a package to display as outdated.
// Default: "patch".
export const getLevel = (): ReleaseType =>
  workspace
    .getConfiguration()
    .get<ReleaseType>("npm-outdated.level") as ReleaseType

// Avoid suggesting that a package be upgraded to a `major` version directly.
// Default: true.
export const hasMajorUpdateProtection = (): boolean =>
  workspace
    .getConfiguration()
    .get<boolean>("npm-outdated.majorUpdateProtection") as boolean

// Time in minutes in which the versions of packages already analyzed will be kept internally.
// Default: 60 minutes.
export const getCacheLifetime = (): number =>
  Number(
    workspace.getConfiguration().get<number>("npm-outdated.cacheLifetime")
  ) *
  60 *
  1000

// Defines how much packages can be analyzed together.
// Default: 10 packages.
export const getParallelProcessesLimit = (): number =>
  workspace
    .getConfiguration()
    .get<number>("npm-outdated.parallelProcessesLimit") as number
