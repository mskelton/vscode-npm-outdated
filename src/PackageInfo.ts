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
  public getLine(): number {
    return this.versionRange.end.line
  }

  // Check if the package is installed.
  public async isInstalled(): Promise<boolean> {
    const packagesInstalled = await getPackagesInstalled()

    if (!packagesInstalled) {
      return false
    }

    return (
      this.name in packagesInstalled &&
      packagesInstalled[this.name] !== undefined
    )
  }

  // Check if is a valid package name.
  // Eg. "typescript" instead of "type script".
  public isNameValid(): boolean {
    return PACKAGE_NAME_REGEXP.test(this.name)
  }

  // Check if is a complex range versions, as it is difficult to understand user needs.
  // Eg. "^13 || ^14.5 || 15.6 - 15.7 || >=16.4 <17"
  public isVersionComplex(): boolean {
    return PACKAGE_VERSION_COMPLEX_REGEXP.test(this.version)
  }

  // If the version specified by the user is a valid range.
  // Eg. { "package": "blah blah blah" } must be invalid and "^3.0" valid.
  public isVersionValidRange(): boolean {
    return validRange(this.version) !== null
  }

  // If the version is a pre-release version.
  // Eg. "13.0.7-canary.3"
  public isVersionPrerelease(): boolean {
    const versionNormalized = this.getVersionNormalized()

    return (
      versionNormalized !== undefined && prerelease(versionNormalized) !== null
    )
  }

  // If the version is the latest version available for this package.
  public async isVersionMaxed(): Promise<boolean> {
    return (await this.getVersionLatest()) === this.getVersionNormalized()
  }

  // If the latest version update require a major bump.
  public async isVersionMajorUpdate(): Promise<boolean> {
    const versionLatest = await this.getVersionLatest()
    const versionInstalled = await this.getVersionInstalled()

    return Boolean(
      versionLatest &&
        versionInstalled &&
        diff(versionLatest, versionInstalled) === "major"
    )
  }

  // Get the package version installed.
  public async getVersionInstalled(): Promise<string | undefined> {
    const packagesInstalled = await getPackagesInstalled()

    return packagesInstalled?.[this.name]
  }

  // Whether version upgrade can be suggested according to user settings.
  // Pre-release versions are always suggested.
  public async isVersionUpgradable(): Promise<boolean> {
    if (this.isVersionPrerelease()) {
      return true
    }

    const versionLatest = await this.getVersionLatest()

    if (!versionLatest) {
      return false
    }

    const versionNormalized = this.getVersionNormalized()

    if (!versionNormalized) {
      return false
    }

    // Check if the version difference is compatible with what was configured by the user.
    // If the difference is less than the minimum configured then there is no need for a diagnostic.
    // Eg. "1.0 => 1.1" is a "minor" diff(). By default, we allow any non-prerelease diff() starting from "patch".
    // Pre-releases user-defined will always be recommended.
    const packageDiff = diff(versionLatest, versionNormalized)

    return Boolean(
      packageDiff &&
        PACKAGE_DIFF_LEVELS[packageDiff] >= PACKAGE_DIFF_LEVELS[getLevel()]
    )
  }

  // If the user-defined version is a released version (including pre-releases).
  public async isVersionReleased(): Promise<boolean> {
    return maxSatisfying(await this.getVersions(), this.version) !== null
  }

  // Strip all non-numeric values from the beginning of a version.
  // In principle, we should use semver.coerce() or semver.clean() for this, but they don't work well for pre-release ranges.
  // Eg.: semver.coerce("^13.0.7-canary.3") => "13.0.7"
  // Eg.: semver.clean("^13.0.7-canary.3") => null
  // Expected: "13.0.7-canary.3"
  public getVersionClear(): string {
    return this.version.replace(/^\D+/, "")
  }

  // Normalizes the package version, through the informed range.
  // If the result is an invalid version, try to correct it via coerce().
  // Eg. "^3" (valid range, but "3" is a invalid version) => "3.0".
  public getVersionNormalized(): string | undefined {
    const version = this.getVersionClear()

    if (!valid(version)) {
      return coerce(version)?.version
    }

    return version
  }

  // Get the latest version released of this package.
  public async getVersionLatest(): Promise<string | null> {
    return getPackageLatestVersion(this)
  }

  // If the latest version is already installed.
  public async isVersionLatestAlreadyInstalled(): Promise<boolean> {
    return (
      (await this.getVersionLatest()) === (await this.getVersionInstalled())
    )
  }

  // Get all versions released of this package.
  public async getVersions(): Promise<string[]> {
    return getPackageVersions(this.name)
  }
}
