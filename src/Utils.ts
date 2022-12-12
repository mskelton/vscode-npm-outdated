import { Diagnostic } from "vscode"

// TypeGuard: validates a settled promise, accepting only when it has been successfully resolved.
export const isPromiseResolved = <T>(
  promiseResult: PromiseSettledResult<T>
): promiseResult is PromiseFulfilledResult<NonNullable<T>> =>
  promiseResult.status === "fulfilled"

export const isCodeAction = (code: Diagnostic["code"]): code is string =>
  typeof code === "string"
