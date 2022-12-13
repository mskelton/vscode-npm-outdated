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
import { PackagesInstalled } from "./NPM"

class Message {
  constructor(
    public message: string,
    public style?: ThemableDecorationAttachmentRenderOptions
  ) {}
}

// We need to create some decoration levels as needed.
// Each layer must have its own style implementation, so that the message order is respected.
// @see https://github.com/microsoft/vscode/issues/169051
class DecorationLayer {
  public static layers: DecorationLayer[] = []

  public lines: Record<number, DecorationOptions> = []

  public type = window.createTextEditorDecorationType({})

  public static getLayer(layer: number): DecorationLayer {
    if (DecorationLayer.layers[layer] === undefined) {
      DecorationLayer.layers[layer] = new DecorationLayer()
    }

    return DecorationLayer.layers[layer]
  }
}

export class DocumentDecoration {
  private editors: TextEditor[]

  constructor(document: TextDocument) {
    this.editors = window.visibleTextEditors.filter(
      (editor) => editor.document === document
    )
  }

  private setLine(line: number, messages: Message[]) {
    messages.forEach((message, messageIndex) => {
      const decorationLayer = DecorationLayer.getLayer(messageIndex)

      decorationLayer.lines[line] = {
        range: new Range(new Position(line, 4096), new Position(line, 4096)),
        renderOptions: {
          after: {
            color: "silver",
            contentText: message.message,
            margin: `0 0 0 ${messageIndex === 0 ? 2 : 1}ch`,
            ...message.style,
          },
        },
      }
    })

    this.flush()
  }

  public clearLine(line: number): void {
    DecorationLayer.layers.forEach((decoration) => {
      delete decoration.lines[line]
    })

    this.flush()
  }

  public setCheckingMessage(line: number) {
    this.setLine(line, [new Message("• Checking for update...")])
  }

  public async setUpdateMessage(
    line: number,
    packageInfo: PackageRelatedDiagnostic,
    packagesInstalled?: PackagesInstalled
  ) {
    const packageVersionInstalled =
      packagesInstalled?.[packageInfo.packageRelated.name]

    const updateDetails = [
      new Message(`🗘`),
      new Message(`Update available:`, { color: "gray" }),
      new Message(packageInfo.packageRelated.versionLatest, { color: "blue" }),
    ]

    if (packageInfo.packageRelated.versionLatest === packageVersionInstalled) {
      updateDetails.push(new Message(`(already installed)`, { color: "black" }))
    }

    this.setLine(line, updateDetails)
  }

  private flush() {
    DecorationLayer.layers.forEach((layer) => {
      this.editors.forEach((editor) =>
        editor.setDecorations(layer.type, Object.values(layer.lines).flat())
      )
    })
  }
}
