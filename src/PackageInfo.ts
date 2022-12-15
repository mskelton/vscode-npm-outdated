import {
  coerce,
  diff,
  maxSatisfying,
  prerelease,
  ReleaseType,
  valid,
  validRange,
} from "semver"

import { Range } from "vscode"

const PACKAGE_NAME_REGEXP =
  /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*$/

const PACKAGE_VERSION_COMPLEX_REGEXP = /\s|\|\|/

const PACKAGE_DIFF_LEVELS: Record<ReleaseType, number> = {
  major: 2,
  minor: 1,
  patch: 0,
  /** ignore */ premajor: -1,
  /** ignore */ preminor: -1,
  /** ignore */ prepatch: -1,
  /** ignore */ prerelease: -1,
}

import {
  getPackageLatestVersion,
  getPackagesInstalled,
  getPackageVersions,
} from "./NPM"
import { getLevel } from "./Settings"

// The package info, based on user-document.
export class PackageInfo {
  constructor(
    public name: string,
    public range: Range,
    public version: string,
    public versionRange: Range // The package version range only.
  ) {}

  // Get the package line on `packages.json` document.
  public getLine() {
    return this.versionRange.end.line
  }

  // Check if the package is installed.
  public async isInstalled() {
    const packagesInstalled = await getPackagesInstalled()

    if (!packagesInstalled) {
      return false
    }

    return this.name in packagesInstalled
  }

  // Check if is a valid package name.
  // Eg. "typescript" instead of "type script".
  public isNameValid() {
    return PACKAGE_NAME_REGEXP.test(this.name)
  }

  // Check if is a complex range versions, as it is difficult to understand user needs.
  // Eg. "^13 || ^14.5 || 15.6 - 15.7 || >=16.4 <17"
  public isVersionComplex() {
    return PACKAGE_VERSION_COMPLEX_REGEXP.test(this.version)
  }

  // If the version specified by the user is a valid range.
  // Eg. { "package": "blah blah blah" } must be invalid and "^3.0" valid.
  public isVersionValidRange() {
    return validRange(this.version)
  }

  // If the version is a pre-release version.
  // Eg. "13.0.7-canary.3"
  public isVersionPrerelease() {
    return prerelease(this.getVersionNormalized()) !== null
  }

  // If the version is the latest version available for this package.
  public async isVersionMaxed() {
    return (await this.getVersionLatest()) === this.getVersionNormalized()
  }

  // Get the package version installed.
  public async getVersionInstalled() {
    const packagesInstalled = await getPackagesInstalled()

    return packagesInstalled?.[this.name]
  }

  // Whether version upgrade can be suggested according to user settings.
  // Pre-release versions are always suggested.
  public async isVersionUpgradable() {
    if (this.isVersionPrerelease()) {
      return true
    }

    const versionLatest = await this.getVersionLatest()

    if (!versionLatest) {
      return false
    }

    // Check if the version difference is compatible with what was configured by the user.
    // If the difference is less than the minimum configured then there is no need for a diagnostic.
    // Eg. "1.0 => 1.1" is a "minor" diff(). By default, we allow any non-prerelease diff() starting from "patch".
    // Pre-releases user-defined will always be recommended.
    const packageDiff = diff(versionLatest, this.getVersionNormalized())

    return (
      packageDiff &&
      PACKAGE_DIFF_LEVELS[packageDiff] >= PACKAGE_DIFF_LEVELS[getLevel()]
    )
  }

  // If the user-defined version is a released version (including pre-releases).
  public async isVersionReleased() {
    return maxSatisfying(await this.getVersions(), this.version) !== null
  }

  // Strip all non-numeric values from the beginning of a version.
  // In principle, we should use semver.coerce() or semver.clean() for this, but they don't work well for pre-release ranges.
  // Eg.: semver.coerce("^13.0.7-canary.3") => "13.0.7"
  // Eg.: semver.clean("^13.0.7-canary.3") => null
  // Expected: "13.0.7-canary.3"
  public getVersionClear() {
    return this.version.replace(/^\D+/, "")
  }

  // Normalizes the package version, through the informed range.
  // If the result is an invalid version, try to correct it via coerce().
  // Eg. "^3" (valid range, but "3" is a invalid version) => "3.0".
  public getVersionNormalized() {
    const version = this.getVersionClear()

    if (!valid(version)) {
      return coerce(version)?.version ?? version
    }

    return version
  }

  // Get the latest version released of this package.
  public async getVersionLatest() {
    return getPackageLatestVersion(this)
  }

  // If the latest version is already installed.
  public async isVersionLatestAlreadyInstalled() {
    return (
      (await this.getVersionLatest()) === (await this.getVersionInstalled())
    )
  }

  // Get all versions released of this package.
  public async getVersions() {
    return getPackageVersions(this.name)
  }
}
