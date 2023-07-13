import { ReleaseType } from "semver"
import { workspace } from "vscode"
import { name as packageName } from "./plugin.json"

// Minimum semver bump required for a package to display as outdated.
// Default: "patch".
export const getLevel = (): ReleaseType =>
  workspace.getConfiguration().get<ReleaseType>(`${packageName}.level`)!

// Avoid suggesting that a package be upgraded to a `major` version directly.
// Default: true.
export const hasMajorUpdateProtection = (): boolean =>
  workspace
    .getConfiguration()
    .get<boolean>(`${packageName}.majorUpdateProtection`)!

// Identifies packages used with known security advisories.
// Default: true.
export const identifySecurityAdvisories = (): boolean =>
  workspace
    .getConfiguration()
    .get<boolean>(`${packageName}.identifySecurityAdvisories`)!

// Displays decorations on the right side of packages.
// Default: true.
export const getDecorationsMode = (): "disabled" | "fancy" | "simple" =>
  workspace.getConfiguration().get(`${packageName}.decorations`)!

// Time in minutes in which the versions of packages already analyzed will be kept internally.
// Default: 60 minutes.
export const getCacheLifetime = (): number =>
  Number(
    workspace.getConfiguration().get<number>(`${packageName}.cacheLifetime`),
  ) *
  60 *
  1000

// Defines how much packages can be analyzed together.
// Default: 20 packages.
export const getParallelProcessesLimit = (): number =>
  workspace
    .getConfiguration()
    .get<number>(`${packageName}.parallelProcessesLimit`)!
