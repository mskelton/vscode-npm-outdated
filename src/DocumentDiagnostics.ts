import { Diagnostic, DiagnosticCollection, TextDocument } from "vscode"
import { lazyCallback } from "./Utils"

// This class assists in managing diagnostics for the document.
export class DocumentDiagnostics {
  private diagnostics: Diagnostic[] = []

  public render = lazyCallback(() => {
    this.diagnosticsCollection.clear()
    this.diagnosticsCollection.set(this.document.uri, this.diagnostics)
  }, 100)

  constructor(
    private document: TextDocument,
    private diagnosticsCollection: DiagnosticCollection
  ) {}

  public push(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic)
    this.render()
  }
}
