import {
  DecorationOptions,
  Position,
  Range,
  TextDocument,
  TextEditor,
  ThemableDecorationAttachmentRenderOptions,
  window,
} from "vscode"
import { PackageRelatedDiagnostic } from "./Diagnostic"

const decorationDefault = window.createTextEditorDecorationType({})

export class DocumentDecoration {
  private decorations: Record<number, DecorationOptions> = {}

  private editor: TextEditor | undefined

  constructor(document: TextDocument) {
    this.editor = window.visibleTextEditors.find(
      (editor) => editor.document === document
    )
  }

  private setLine(
    line: number,
    message: string,
    style: ThemableDecorationAttachmentRenderOptions = {}
  ) {
    this.decorations[line] = {
      range: new Range(new Position(line, 4096), new Position(line, 4096)),
      renderOptions: {
        after: {
          color: "silver",
          contentText: message,
          margin: "0 0 0 3ch",
          ...style,
        },
      },
    }

    this.flush()
  }

  public clearLine(line: number): void {
    delete this.decorations[line]

    this.flush()
  }

  public setCheckingMessage(line: number) {
    this.setLine(line, "• Checking for update...")
  }

  public setUpdateMessage(line: number, packageInfo: PackageRelatedDiagnostic) {
    this.setLine(
      line,
      `🗘 Update available: ${packageInfo.packageRelated.versionLatest}`,
      { color: "blue" }
    )
  }

  private flush() {
    this.editor?.setDecorations(
      decorationDefault,
      Object.values(this.decorations)
    )
  }
}
