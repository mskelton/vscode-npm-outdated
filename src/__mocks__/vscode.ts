export class Range {
  public start: { character: number; line: number }
  public end: { character: number; line: number }

  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  ) {
    this.start = { character: startCharacter, line: startLine }
    this.end = { character: endCharacter, line: endLine }
  }
}

export const ExtensionContext = jest.fn(() => ({
  subscriptions: jest.fn(() => ({
    push: jest.fn(),
  })),
}))

export class Diagnostic {
  constructor(
    public range: typeof Range,
    public message: string,
    public severity?: DiagnosticSeverity,
  ) {}
}

export enum DiagnosticSeverity {
  Error,
  Warning,
  Information,
  Hint,
}

export const CodeActionKind = {
  QuickFix: "QuickFix",
}

export const commands = {}

export const languages = {
  registerCodeActionsProvider: jest.fn(),
}

export const window = {
  createTextEditorDecorationType: (): symbol => Symbol(),
}

export const Uri = {
  parse: (): undefined => undefined,
}

export const workspace = jest.fn()

export const WorkspaceEdit = jest.fn(() => ({
  replace: (): undefined => undefined,
}))

export class CodeAction {
  constructor(public title: string) {}
}

export const l10n = {
  t: (message: string, ...args: unknown[]): string => {
    let messageModified = message

    args.forEach((arg, argIndex) => {
      messageModified = messageModified.replaceAll(`{${argIndex}}`, String(arg))
    })

    return messageModified
  },
}
