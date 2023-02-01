import { ReleaseType } from "semver"
import { workspace } from "vscode"
import { pluginName } from "./plugin.js"

// Minimum semver bump required for a package to display as outdated.
// Default: "patch".
export const getLevel = (): ReleaseType =>
  workspace.getConfiguration().get<ReleaseType>(`${pluginName}.level`)!

// Avoid suggesting that a package be upgraded to a `major` version directly.
// Default: true.
export const hasMajorUpdateProtection = (): boolean =>
  workspace
    .getConfiguration()
    .get<boolean>(`${pluginName}.majorUpdateProtection`)!

// Identifies packages used with known security advisories.
// Default: true.
export const identifySecurityAdvisories = (): boolean =>
  workspace
    .getConfiguration()
    .get<boolean>(`${pluginName}.identifySecurityAdvisories`)!

// Displays decorations on the right side of packages.
// Default: true.
export const getDecorationsMode = (): "fancy" | "simple" | "disabled" =>
  workspace.getConfiguration().get(`${pluginName}.decorations`)!

// Time in minutes in which the versions of packages already analyzed will be kept internally.
// Default: 60 minutes.
export const getCacheLifetime = (): number =>
  Number(
    workspace.getConfiguration().get<number>(`${pluginName}.cacheLifetime`)
  ) *
  60 *
  1000

// Defines how much packages can be analyzed together.
// Default: 20 packages.
export const getParallelProcessesLimit = (): number =>
  workspace
    .getConfiguration()
    .get<number>(`${pluginName}.parallelProcessesLimit`)!
