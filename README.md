# VS Code npm Outdated

[![Build status](https://img.shields.io/github/workflow/status/mskelton/vscode-npm-outdated/Release/main.svg?logo=github)](https://github.com/mskelton/vscode-npm-outdated/actions?query=workflow%3ARelease)
[![Semantic release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Displays a diagnostic message in package.json files for packages which have newer versions available as well as a code action to quickly update packages to their latest version.

![Screenshot](https://github.com/mskelton/vscode-npm-outdated/blob/main/images/screenshot.jpg)

## Usage

This extension provides three primary means of updating outdated packages. The following code actions are available in `package.json` files.

1. `Update all packages` - This command will update all `dependencies` and `devDependencies` in the package.json file.
1. `Update package` - This command will update a single package to the latest version. This will show when a single package is selected.
1. `Update x packages` - This command will update all the selected packages to the latest version. This will show when multiple packages are selected.
