import { Diagnostic, DiagnosticCollection, TextDocument } from "vscode"

// This class assists in managing diagnostics for the document.
export class DocumentDiagnostics {
  private diagnostics: Diagnostic[] = []

  constructor(
    private document: TextDocument,
    private diagnosticsCollection: DiagnosticCollection
  ) {
    diagnosticsCollection.clear()
  }

  public push(diagnostic: Diagnostic) {
    this.diagnostics.push(diagnostic)
    this.flush()
  }

  private flush() {
    this.diagnosticsCollection.set(this.document.uri, this.diagnostics)
  }
}
