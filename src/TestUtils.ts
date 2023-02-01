import { jest } from "@jest/globals"
import ChildProcess from "node:child_process"
import { sep } from "node:path"
import { ReleaseType } from "semver"
import * as vscode from "vscode"
import { Range } from "vscode"
import { PackageJsonCodeActionProvider } from "./CodeAction.js"
import { DocumentDecorationManager } from "./DocumentDecoration.js"
import { activate } from "./extension.js"
import { PackageAdvisory } from "./NPM.js"
import { pluginName } from "./plugin.js"
import * as Utils from "./Utils.js"

interface PluginConfigurations {
  cacheLifetime?: number
  decorations?: "fancy" | "simple" | "disabled"
  identifySecurityAdvisories?: boolean
  level?: ReleaseType
  majorUpdateProtection?: boolean
  parallelProcessesLimit?: number
}

const DefaultPluginConfigurations: PluginConfigurations = {
  cacheLifetime: 0,
  decorations: "fancy",
  identifySecurityAdvisories: true,
  level: "patch",
  majorUpdateProtection: true,
  parallelProcessesLimit: 0,
}

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface SimulatorOptions {
  cacheEnabled?: boolean

  configurations?: PluginConfigurations

  execError?: boolean

  packageJson?: "" | PackageJson

  packagesAdvisories?: Record<string, PackageAdvisory[]>

  packagesInstalled?: Record<string, string>

  packagesRepository?: Record<string, string[]>

  runAction?: { args?: ExplicitAny[]; name: string }

  selectFirsts?: number

  triggerChangeAfter?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExplicitAny = any

const vscodeMock = vscode as {
  commands: ExplicitAny
  languages: ExplicitAny
  Range: ExplicitAny
  window: ExplicitAny
  workspace: ExplicitAny
}

const ChildProcessMock = ChildProcess as {
  exec: ExplicitAny
}

const UtilsMock = Utils as {
  cacheEnabled(): boolean
  fetchLite: unknown
}

const dependenciesAsChildren = (
  dependencies: Record<string, string>
): vscode.DocumentSymbol[] => {
  return Object.entries(dependencies).map(([name, version], entryIndex) => {
    return {
      detail: version,
      name,
      range: new Range(entryIndex, 0, entryIndex, 0) as unknown as Range,
    } as vscode.DocumentSymbol
  })
}

type ExecCallback = (error: string | null, stdout: string | null) => void

// Simulates launching diagnostics in a virtual packages.json file.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const vscodeSimulator = async (options: SimulatorOptions = {}) => {
  let actions: vscode.CodeAction[] = []
  let diagnostics: vscode.Diagnostic[] = []
  let decorations: string[][] = []

  const windowsInformation: [string, string[]][] = []

  const subscriptions: [string, (...args: ExplicitAny[]) => void][] = []
  const commands: [string, (...args: ExplicitAny[]) => void][] = []

  const document = {
    fileName: `${sep}tests${sep}package.json`,
    lineAt: (line: number) => ({
      text: {
        slice: (): string =>
          (options.packageJson as PackageJson).dependencies?.[line] ?? "",
      },
    }),
    uri: { fsPath: `${sep}tests` },
  } as vscode.TextDocument

  const editor = {
    document,
    setDecorations: (): void => {
      decorations = []

      Array.from(
        DocumentDecorationManager.fromDocument(document).layers.values()
      ).forEach((layer) => {
        layer.lines.forEach((line) => {
          const lineIndex = line.range.start.line

          decorations[lineIndex] ??= []
          decorations[lineIndex]!.push(
            String(line.renderOptions?.after?.contentText)
          )
        })
      })
    },
  }

  UtilsMock.cacheEnabled = (): boolean => options.cacheEnabled === true

  UtilsMock.fetchLite = ({ url }: { url: string }): unknown => {
    if (url.endsWith("/bulk")) {
      return options.packagesAdvisories
    }

    if (options.packagesRepository) {
      for (const packageName of Object.keys(options.packagesRepository)) {
        if (
          url.endsWith(`/${packageName}`) &&
          packageName in options.packagesRepository &&
          !packageName.startsWith("@private/")
        ) {
          return Promise.resolve({
            versions: Object.fromEntries(
              options.packagesRepository[packageName].map((version) => [
                version,
                null,
              ]) as []
            ),
          })
        }
      }
    }

    return Promise.resolve(undefined)
  }

  ChildProcessMock.exec = (
    command: string,
    execOptions: ExecCallback | undefined,
    callback?: ExecCallback
  ): unknown => {
    const callbackReal = callback ?? execOptions

    if (command === "npm ls --json --depth=0" && options.packagesInstalled) {
      return callbackReal!(
        null,
        JSON.stringify({
          dependencies: Object.fromEntries(
            Object.entries(options.packagesInstalled).map(([name, version]) => [
              name,
              { version },
            ])
          ),
        })
      )
    }

    if (typeof callbackReal === "function") {
      if (command === "npm view --json @private/npm-outdated versions") {
        callbackReal(
          null,
          JSON.stringify(options.packagesRepository!["@private/npm-outdated"])
        )

        return
      }

      callbackReal("error", null)
    }

    return {
      on: (_data: ExplicitAny, callback: () => void) => callback(),
      stderr: {
        on: (_data: ExplicitAny, callback: (message: string) => void) =>
          options.execError ? callback("test") : null,
      },
      stdout: {
        on: (_data: ExplicitAny, callback: (message: string) => void) =>
          callback("test"),
      },
    }
  }

  vscodeMock.commands.executeCommand = (
    command: string
  ): Record<string, ExplicitAny> | string | undefined => {
    if (command === "vscode.executeDocumentSymbolProvider") {
      const symbols = []

      if (!options.packageJson) {
        return undefined
      }

      if (options.packageJson.dependencies) {
        symbols.push({
          children: dependenciesAsChildren(options.packageJson.dependencies),
          name: "dependencies",
        })
      }

      if (options.packageJson.devDependencies) {
        symbols.push({
          children: dependenciesAsChildren(options.packageJson.devDependencies),
          name: "devDependencies",
        })
      }

      return symbols
    }

    if (command === "npm.packageManager") {
      return "npm"
    }

    return undefined
  }

  vscodeMock.commands.registerCommand = (
    name: string,
    callback: (...args: ExplicitAny[]) => void
  ): number => commands.push([name, callback])

  vscodeMock.window.activeTextEditor = editor
  vscodeMock.window.visibleTextEditors = [editor]

  vscodeMock.window.onDidChangeActiveTextEditor = (
    handle: () => void
  ): number => subscriptions.push(["onDidChangeActiveTextEditor", handle])

  vscodeMock.window.showInformationMessage =
    vscodeMock.window.showErrorMessage = (
      message: string,
      ...items: string[]
    ): string | undefined => {
      windowsInformation.push([message, items])

      return items[0]
    }

  vscodeMock.window.createOutputChannel = jest.fn(() => ({
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
  }))

  vscodeMock.workspace.onDidChangeTextDocument = (handle: () => void): number =>
    subscriptions.push(["onDidChangeTextDocument", handle])

  vscodeMock.workspace.onDidCloseTextDocument = (handle: () => void): number =>
    subscriptions.push(["onDidCloseTextDocument", handle])

  vscodeMock.workspace.createFileSystemWatcher = (): unknown => ({
    onDidChange: (handle: () => void): number =>
      subscriptions.push(["onDidChange", handle]),
  })

  vscodeMock.workspace.getConfiguration = (): unknown => ({
    get: jest.fn(
      <T extends keyof PluginConfigurations>(name: `${string}.${T}`) => {
        const nameWithoutPrefix = name.slice(pluginName.length + 1) as T

        return options.configurations &&
          nameWithoutPrefix in options.configurations
          ? options.configurations[nameWithoutPrefix]
          : DefaultPluginConfigurations[nameWithoutPrefix]
      }
    ),
  })

  vscodeMock.languages.createDiagnosticCollection = jest.fn(() => ({
    clear: jest.fn(),
    delete: jest.fn(),
    set: (_uri: vscode.Uri, diags: vscode.Diagnostic[]): vscode.Diagnostic[] =>
      (diagnostics = diags),
  }))

  vscodeMock.languages.getDiagnostics = (): vscode.Diagnostic[] => diagnostics

  vscodeMock.Range = class extends vscode.Range {
    public intersection(_range: Range): Range | undefined {
      return options.selectFirsts !== undefined &&
        this.end.line + 1 <= options.selectFirsts
        ? this
        : undefined
    }
  }

  const context = { subscriptions: { push: jest.fn() } }

  activate(context as unknown as vscode.ExtensionContext)

  if (options.triggerChangeAfter) {
    subscriptions.find(
      (subscription) => subscription[0] === "onDidChangeTextDocument"
    )?.[1]({ document })
  }

  if (options.selectFirsts !== undefined) {
    await new Promise(process.nextTick)

    actions = await new PackageJsonCodeActionProvider().provideCodeActions(
      document,
      new Range(0, 0, 0, 0)
    )

    if (options.runAction !== undefined) {
      const command = commands.find(
        (command) => command[0] === options.runAction?.name
      )

      command?.[1].apply(this, options.runAction.args!)
    }
  }

  await new Promise(process.nextTick)

  return {
    actions,
    decorations,
    diagnostics,
    document,
    subscriptions,
    windowsInformation,
  }
}
