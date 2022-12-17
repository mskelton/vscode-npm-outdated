jest.mock("child_process")

import { COMMAND_INSTALL, COMMAND_INSTALL_REQUEST } from "./Command"
import { vscodeSimulator } from "./TestUtils"

describe("package diagnostics", () => {
  it("initialization without a package.json", async () => {
    const { decorations, diagnostics } = await vscodeSimulator()

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("initialization without an empty package.json", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: "",
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("initialization with package.json without dependencies", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: {},
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("valid dependency, pending installation", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesRepository: { "npm-outdated": ["1.0.0"] },
    })

    expect(diagnostics[0]?.message).toContain("pending installation")
    expect(decorations).toContain("Install pending")
  })

  it("valid dependency, already installed, just formalization", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.1" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(diagnostics[0]?.message).toContain("1.0.1")
    expect(decorations).toContain("(already installed, just formalization)")
  })

  it("valid dependency, newer version available", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(decorations).toContain("Update available:")
  })

  it("valid dependency, newer version available, avoid major dump", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1", "2.0.0"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(diagnostics[0]?.message).toContain("1.0.1")
    expect(decorations).toContain("Update available:")
  })

  it("valid dependency, newer version available, suggesting major dump", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1", "2.0.0"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(diagnostics[0]?.message).toContain("2.0.0")
    expect(decorations).toContain("(attention: major update!)")
  })

  it("valid dependency, newer version available, major dump protection disabled", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      configurations: { majorUpdateProtection: false },
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1", "2.0.0"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(diagnostics[0]?.message).toContain("2.0.0")
    expect(decorations).toContain("(attention: major update!)")
  })

  it("valid dependency, newer version available (using cache)", async () => {
    const { decorations: decorations1, diagnostics: diagnostics1 } =
      await vscodeSimulator({
        packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
        packagesInstalled: { "npm-outdated": "1.0.0" },
        packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
      })

    expect(diagnostics1[0]?.message).toContain("Newer version")
    expect(decorations1).toContain("Update available:")

    const { decorations: decorations2, diagnostics: diagnostics2 } =
      await vscodeSimulator({
        cacheEnabled: true,
        packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
        packagesInstalled: { "npm-outdated": "1.0.0" },
        packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
      })

    expect(diagnostics2[0]?.message).toContain("Newer version")
    expect(decorations2).toContain("Update available:")
  })

  it("valid dev dependency, newer version available", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { devDependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics[0]?.message).toContain("Newer version")
    expect(diagnostics[0]?.message).toContain("1.0.1")
    expect(decorations).toContain("Update available:")
  })

  it("valid dependency, package version not available", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1" } },
      packagesRepository: { "npm-outdated": ["1.0.0"] },
    })

    expect(diagnostics[0]?.message).toContain("not available")
    expect(decorations).toContain("(install pending)")
  })

  it("valid dependency, latest pre-release", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1-alpha" } },
      packagesInstalled: { "npm-outdated": "1.0.1-alpha" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1-alpha"] },
    })

    expect(diagnostics[0]?.message).toContain("Pre-release version")
    expect(decorations).toContain("🗘") // Because it was cleared.
  })

  it("valid dependency, newer pre-release available", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1-alpha" } },
      packagesInstalled: { "npm-outdated": "1.0.1-alpha" },
      packagesRepository: {
        "npm-outdated": ["1.0.0", "1.0.1-alpha", "1.0.2-alpha"],
      },
    })

    expect(diagnostics[0]?.message).toContain("1.0.2-alpha")
    expect(decorations).toContain("<pre-release>")
  })

  it("valid dependency, newer stable-after pre-release available", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1-alpha" } },
      packagesInstalled: { "npm-outdated": "1.0.1-alpha" },
      packagesRepository: {
        "npm-outdated": ["1.0.0", "1.0.1-alpha", "1.0.1"],
      },
    })

    expect(diagnostics[0]?.message).toContain("1.0.1")
    expect(decorations).toContain("Update available:")
  })

  it("valid dependency, latest available version", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1" } },
      packagesInstalled: { "npm-outdated": "1.0.1" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toContain("🗘") // Because it is the latest available.
  })

  it("valid dependency, with partial version", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "1" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0"] },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toContain("🗘") // Because it is the latest available.
  })

  it("valid dependency, suggests minor or greater only", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      configurations: { level: "minor" },
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toContain("🗘") // Cleared.
  })

  it("valid dependency, but cannot get latest version (exception case)", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1" } },
      packagesInstalled: { "npm-outdated": "1.0.1" },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toContain("🗘") // Cleared.
  })

  it("valid dependency, no diagnostic", async () => {
    const { diagnostics } = await vscodeSimulator({
      configurations: { level: "major" },
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(diagnostics).toHaveLength(0)
  })

  it("dependency name is invalid", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "invalid!": "^1.0.0" } },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([]) // No requires diagnostics.
  })

  it("dependency version is complex", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0 || ^2.0.0" } },
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([]) // No requires diagnostics.
  })

  it("dependency version is invalid", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^a.b.c" } },
    })

    expect(diagnostics[0]?.message).toContain("Invalid package version")
    expect(decorations).toContain("🗘")
  })

  it("decorations disabled", async () => {
    const { decorations } = await vscodeSimulator({
      configurations: { decorations: false },
      packageJson: { devDependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
    })

    expect(decorations).toStrictEqual([])
    expect(decorations).toStrictEqual([])
  })
})

describe("code actions", () => {
  it("no package selected", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.1" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
      selectFirsts: 0,
    })

    expect(actions).toHaveLength(0)
  })

  it("selected a specific package", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
      selectFirsts: 1,
    })

    expect(actions[0]?.title).toBe('Update "npm-outdated" to 1.0.1')
    expect(actions).toHaveLength(1)
  })

  it("selected first package only", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "1.0.1"],
        "npm-outdated": ["1.0.0", "1.0.1"],
      },
      selectFirsts: 1,
    })

    expect(actions[0]?.title).toBe('Update "@typescript/eslint" to 1.0.1')
    expect(actions[1]?.title).toBe("Update all 2 packages")
    expect(actions).toHaveLength(2)
  })

  it("selected first package only, both major updates", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "2.0.0"],
        "npm-outdated": ["1.0.0", "2.0.0"],
      },
      selectFirsts: 1,
    })

    expect(actions[0]?.title).toBe(
      'Update "@typescript/eslint" to 2.0.0 (major)'
    )
    expect(actions[1]?.title).toBe("Update all 2 packages (major)")
    expect(actions).toHaveLength(2)
  })

  it("selected first package only, both major updates (protection disabled)", async () => {
    const { actions } = await vscodeSimulator({
      configurations: {
        majorUpdateProtection: false,
      },
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "2.0.0"],
        "npm-outdated": ["1.0.0", "2.0.0"],
      },
      selectFirsts: 1,
    })

    expect(actions[0]?.title).toBe('Update "@typescript/eslint" to 2.0.0')
    expect(actions[1]?.title).toBe("Update all 2 packages")
    expect(actions).toHaveLength(2)
  })

  it("selected all two packages", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "1.0.1"],
        "npm-outdated": ["1.0.0", "1.0.1"],
      },
      selectFirsts: 2,
    })

    expect(actions[0]?.title).toBe("Update 2 selected packages")
    expect(actions).toHaveLength(1)
  })

  it("selected all two packages, but one is major update (protection enabled)", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "2.0.0"],
        "npm-outdated": ["1.0.0", "1.0.1"],
      },
      selectFirsts: 2,
    })

    expect(actions[0]?.title).toBe('Update "npm-outdated" to 1.0.1')
    expect(actions).toHaveLength(1)
  })

  it("selected all two packages, but one is major update (protection disabled)", async () => {
    const { actions } = await vscodeSimulator({
      configurations: {
        majorUpdateProtection: false,
      },
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "2.0.0"],
        "npm-outdated": ["1.0.0", "1.0.1"],
      },
      selectFirsts: 2,
    })

    expect(actions[0]?.title).toBe("Update 2 selected packages")
    expect(actions).toHaveLength(1)
  })

  it("selected all two packages, both are major update", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: {
        dependencies: {
          "@typescript/eslint": "^1.0.0",
          "npm-outdated": "^1.0.0",
        },
      },
      packagesInstalled: {
        "@typescript/eslint": "1.0.0",
        "npm-outdated": "1.0.0",
      },
      packagesRepository: {
        "@typescript/eslint": ["1.0.0", "2.0.0"],
        "npm-outdated": ["1.0.0", "2.0.0"],
      },
      selectFirsts: 2,
    })

    expect(actions[0]?.title).toBe("Update 2 selected packages (major)")
    expect(actions).toHaveLength(1)
  })
})

describe("commands", () => {
  it("notify install", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "2.0.0"] },
      runAction: {
        args: [{ fsPath: "./test" }],
        name: COMMAND_INSTALL_REQUEST,
      },
      selectFirsts: 1,
    })

    expect(actions).toHaveLength(1)
  })

  it("install success", async () => {
    const { actions } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "2.0.0"] },
      runAction: {
        args: ["npm install", "./"],
        name: COMMAND_INSTALL,
      },
      selectFirsts: 1,
    })

    expect(actions).toHaveLength(1)
  })

  it("install failure", async () => {
    const { actions } = await vscodeSimulator({
      execError: true,
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "2.0.0"] },
      runAction: {
        args: ["npm install", "./"],
        name: COMMAND_INSTALL,
      },
      selectFirsts: 1,
    })

    expect(actions).toHaveLength(1)
  })
})

describe("code coverage", () => {
  it("simulate change active text editor", async () => {
    const { decorations, diagnostics, document, subscriptions } =
      await vscodeSimulator()

    subscriptions.find(
      (subscription) => subscription[0] === "onDidChangeActiveTextEditor"
    )?.[1]({ document })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("simulate change text document", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      triggerChangeAfter: true,
    })

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("simulate packages-lock.json change", async () => {
    const { decorations, diagnostics, subscriptions } = await vscodeSimulator()

    subscriptions.find(
      (subscription) => subscription[0] === "onDidChange"
    )?.[1]()

    expect(diagnostics).toHaveLength(0)
    expect(decorations).toStrictEqual([])
  })

  it("simulate close text document", async () => {
    const { decorations, diagnostics, document, subscriptions } =
      await vscodeSimulator({
        packageJson: { dependencies: { "npm-outdated": "^a.b.c" } },
      })

    subscriptions.find(
      (subscription) => subscription[0] === "onDidCloseTextDocument"
    )?.[1](document)

    expect(diagnostics).toHaveLength(1)
    expect(decorations).toContain("🗘")
  })

  it("decoration re-flush layers", async () => {
    const { decorations, diagnostics } = await vscodeSimulator({
      packageJson: { dependencies: { "npm-outdated": "^1.0.0" } },
      packagesInstalled: { "npm-outdated": "1.0.0" },
      packagesRepository: { "npm-outdated": ["1.0.0", "1.0.1"] },
      triggerChangeAfter: true,
    })

    expect(diagnostics).toHaveLength(1)
    expect(decorations).toContain("Update available:")
  })
})
