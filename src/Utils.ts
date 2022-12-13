import { Diagnostic } from "vscode"

// TypeGuard: check if the Diagnostic.code is a string.
// This function is only useful as Diagnostic.code can have other types of allowed values, but we just use them as a string.
export const isCodeAction = (code: Diagnostic["code"]): code is string =>
  typeof code === "string"
