import { Diagnostic } from "vscode"

// TypeGuard: check if the Diagnostic.code is a string.
// This function is only useful as Diagnostic.code can have other types of allowed values, but we just use them as a string.
export const isCodeAction = (code: Diagnostic["code"]): code is string =>
  typeof code === "string"

// This function allows to make a function "lazy". Although its first execution happens immediately, the next execution only occurs when this one ends.
// Furthermore, if several executions happen at the same time, only the last one will be actually be executed.
export const lazyCallback = <T, A>(callback: (...args: A[]) => T) => {
  // Defines whether there is a process currently running.
  let isRunning = false

  // It only stores the arguments for the next run, since the callback will be the same.
  // It is important to remember that the arguments will be discarded if a new execution is requested,
  // so we always prioritize the last execution and discard anything before it, with the exception of the current process.
  let argsNext: A[] | undefined = undefined

  // Here's the magic: a "activator" is returned, instead of the original callback.
  // It manages when the current execution ends and when the next one starts, if it exists.
  const activate = async (...args: A[]) => {
    if (!isRunning) {
      // If no callback is running right now, then run the current one immediately.
      // After the execution ends, it releases for another process to run.
      isRunning = true
      await callback(...args)
      isRunning = false

      // If afterwards there is already some callback waiting to be executed, it starts it immediately.
      // Note that this will only happen after the full completion of the previous process.
      if (argsNext !== undefined) {
        activate(...argsNext)
        argsNext = undefined
      }
    } else {
      // If there is already a process running, we only store the arguments for the next run.
      argsNext = args
    }
  }

  return activate
}
