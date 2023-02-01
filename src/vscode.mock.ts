import { jest } from "@jest/globals"

export function createVscode() {
  class Range {
    public start: { character: number; line: number }
    public end: { character: number; line: number }

    constructor(
      startLine: number,
      startCharacter: number,
      endLine: number,
      endCharacter: number
    ) {
      this.start = { character: startCharacter, line: startLine }
      this.end = { character: endCharacter, line: endLine }
    }
  }

  const ExtensionContext = jest.fn(() => ({
    subscriptions: jest.fn(() => ({
      push: jest.fn(),
    })),
  }))

  class Diagnostic {
    constructor(
      public range: typeof Range,
      public message: string,
      public severity?: DiagnosticSeverity
    ) {}
  }

  enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
  }

  const CodeActionKind = {
    QuickFix: "QuickFix",
  }

  const commands = {}

  const languages = {
    registerCodeActionsProvider: jest.fn(),
  }

  const window = {
    createTextEditorDecorationType: (): symbol => Symbol(),
  }

  const Uri = {
    parse: (): undefined => undefined,
  }

  const workspace = jest.fn()

  const WorkspaceEdit = jest.fn(() => ({
    replace: (): undefined => undefined,
  }))

  class CodeAction {
    constructor(public title: string) {}
  }

  const l10n = {
    t: (message: string, ...args: unknown[]): string => {
      let messageModified = message

      args.forEach((arg, argIndex) => {
        messageModified = messageModified.replace(
          new RegExp(`\\{${argIndex}\\}`, "g"),
          String(arg)
        )
      })

      return messageModified
    },
  }

  return {
    CodeAction,
    CodeActionKind,
    commands,
    Diagnostic,
    DiagnosticSeverity,
    ExtensionContext,
    l10n,
    languages,
    Range,
    Uri,
    window,
    workspace,
    WorkspaceEdit,
  }
}
