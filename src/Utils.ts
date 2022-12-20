import url = require("node:url")
import https = require("node:https")
import zlib = require("node:zlib")

import { IncomingMessage } from "http"

// This function allows to call a "lazy" callback.
// The first execution can be delayed when the "wait" parameter is different from zero, otherwise it will be immediate.
// The next execution can be delayed as long as "delay" is non - zero, with a minimum time of zero ms.
// Furthermore, if several executions happen at the same time, only the last one will be actually be executed.
export const lazyCallback = <T, A>(
  callback: (...args: A[]) => T,
  wait = 0,
  delay = 0
): ((...args: A[]) => Promise<void>) => {
  // Defines whether there is a process currently running.
  let isRunning = false

  // It only stores the arguments for the next run, since the callback will be the same.
  // It is important to remember that the arguments will be discarded if a new execution is requested,
  // so we always prioritize the last execution and discard anything before it, with the exception of the current process.
  let argsNext: A[] | undefined = undefined

  // Here's the magic: a "activator" is returned, instead of the original callback.
  // It manages when the current execution ends and when the next one starts, if it exists.
  const activate = async (...args: A[]): Promise<void> => {
    if (!isRunning) {
      // If no callback is running right now, then run the current one immediately.
      isRunning = true

      if (wait === 0) {
        await callback(...args)
      } else {
        await new Promise<void>((resolve) => {
          setTimeout(async () => {
            // Must execute the callback with the most recent arguments, if any.
            if (argsNext) {
              const argsNextCopied = argsNext
              argsNext = undefined

              await callback(...argsNextCopied)
            } else {
              await callback(...args)
            }

            resolve()
          }, wait)
        })
      }

      // If afterwards there is already some callback waiting to be executed, it starts it after the delay.
      // Note that this will only happen after the full completion of the previous process.
      setTimeout(() => {
        // After the execution ends, it releases for another process to run.
        isRunning = false

        if (argsNext !== undefined) {
          activate(...argsNext)
          argsNext = undefined
        }
      }, delay)
    } else {
      // If there is already a process running, we only store the arguments for the next run.
      argsNext = args
    }
  }

  return activate
}

// This function checks if a promise can be processed as long as the conditional callback returns true.
// @see https://stackoverflow.com/a/64947598/755393
export const waitUntil = (
  condition: () => Promise<boolean>,
  retryDelay = 0
): Promise<void> => {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      if (!(await condition())) {
        return
      }

      clearInterval(interval)
      resolve()
    }, retryDelay)
  })
}

type OptionalPromise<T> = T | Promise<T>

// This function lets you control how many promises can be worked on concurrently.
// As soon as one promise ends, another one can be processed.
// If the concurrency number is zero then they will be processed immediately.
export const promiseLimit = (
  concurrency: number
): (<T>(func: () => T) => OptionalPromise<T>) => {
  // If concurrency is zero, all promises are executed immediately.
  if (concurrency === 0) {
    return <T>(func: () => T): T => {
      return func()
    }
  }

  let inProgress = 0

  return async <T>(func: () => T): Promise<T> => {
    // Otherwise, it will be necessary to wait until there is a "vacancy" in the concurrency process for the promise to be executed.
    await waitUntil(() => Promise.resolve(inProgress < concurrency))

    // As soon as this "vacancy" is made available, the function is executed.
    // Note that the execution of the function "takes a seat" during the process.
    inProgress++
    const funcResult = await func()
    inProgress--

    return funcResult
  }
}

// During testing, this function is mocked to return false in some cases.
export const cacheEnabled = (): boolean => true

// A simple post request.
// Based on https://github.com/vasanthv/fetch-lite/blob/master/index.js
export const fetchLite = <T>(
  paramUrl: string,
  method?: "get" | "post" | undefined,
  body?: object | undefined
): Promise<T | undefined> => {
  return new Promise<T | undefined>((resolve) => {
    const { hostname, path } = url.parse(paramUrl)
    const headers = { "content-type": "application/json" }

    const thisReq = https.request(
      { headers, hostname, method: method ?? "get", path },
      (response: IncomingMessage) => {
        const responseBuffers: Buffer[] = []

        response.on("data", (data: Buffer) => responseBuffers.push(data))
        // istanbul ignore next
        response.on("error", () => resolve(undefined))
        response.on("end", () => {
          return zlib.gunzip(
            Buffer.concat(responseBuffers),
            (_error, contents) => {
              resolve(JSON.parse(contents.toString()))
            }
          )
        })
      }
    )

    thisReq.setHeader("Content-Type", "application/json")
    thisReq.setHeader("Content-Encoding", "gzip")
    thisReq.setHeader("Accept-Encoding", "gzip")

    if (body !== undefined) {
      const bodyStringify = zlib.gzipSync(JSON.stringify(body))

      thisReq.setHeader("Content-Length", bodyStringify.length)
      thisReq.write(bodyStringify)
    }

    // istanbul ignore next
    thisReq.on("error", () => resolve(undefined))
    thisReq.end()
  })
}
