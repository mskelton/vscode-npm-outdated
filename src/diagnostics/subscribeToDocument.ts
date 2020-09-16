import vscode from "vscode"

export function subscribeToDocument(
  ctx: vscode.ExtensionContext,
  diagnostics: vscode.DiagnosticCollection,
  onChange: (document: vscode.TextDocument) => void
): void {
  function handleChange(doc: vscode.TextDocument) {
    if (doc.fileName.endsWith("/package.json")) {
      onChange(doc)
    }
  }

  if (vscode.window.activeTextEditor) {
    handleChange(vscode.window.activeTextEditor.document)
  }

  ctx.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        handleChange(editor.document)
      }
    })
  )

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => handleChange(e.document))
  )

  ctx.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnostics.delete(doc.uri)
    )
  )
}
