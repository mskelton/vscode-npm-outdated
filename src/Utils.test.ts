import { cacheEnabled, fetchLite, lazyCallback, promiseLimit } from "./Utils"
describe("utils", () => {
  it("lazy callback: immediate call", async () => {
    expect.assertions(1)

    const lazy = lazyCallback((callNumber: () => void) => {
      callNumber()
    })

    const now = Date.now()

    // Must run immediately:
    lazy(() => {
      expect(Date.now() - now).toBeLessThan(25)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it("lazy callback: avoid first call", async () => {
    expect.assertions(1)

    const lazy = lazyCallback((callNumber: () => void) => {
      callNumber()
    }, 25)

    const now = Date.now()

    // Must run be ignored:
    lazy(() => expect.assertions(0))

    // Must run after 25ms:
    lazy(() => {
      expect(Date.now() - now).toBeGreaterThanOrEqual(25)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it("lazy callback: wait first call", async () => {
    expect.assertions(1)

    const lazy = lazyCallback((callNumber: () => void) => {
      callNumber()
    }, 25)

    const now = Date.now()

    // Must run after 25ms:
    lazy(() => {
      expect(Date.now() - now).toBeGreaterThanOrEqual(25)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it("lazy callback: avoid second call", async () => {
    expect.assertions(3)

    const lazy = lazyCallback(
      (callNumber: () => void) => {
        callNumber()
      },
      0,
      25
    )

    const now = Date.now()

    // Must run immediately:
    lazy(() => expect(Date.now() - now).toBeLessThan(25))

    // Must be skipped: too fast call.
    lazy(() => {
      expect.assertions(0)
    })

    // Must run after 25ms:
    lazy(() => {
      const nowDiff = Date.now() - now

      expect(nowDiff).toBeGreaterThanOrEqual(25)
      expect(nowDiff).toBeLessThan(50)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it("promise limit: prevent multiple simultaneous processes", async () => {
    expect.assertions(1)

    const processesLimit = promiseLimit(2)

    const delay = (): Promise<unknown> =>
      new Promise((resolve) => setTimeout(resolve, 25))

    const now = Date.now()

    // The first two promises will execute immediately and wait 25ms to complete.
    // The third promise will wait another 25ms.
    await Promise.all([
      processesLimit(() => delay()),
      processesLimit(() => delay()),
      processesLimit(() => delay()),
    ])

    // The total time should be 50ms.
    expect(Date.now() - now).toBeGreaterThanOrEqual(50)
  })

  it("promise limit: run all processes simultaneous (no limit)", async () => {
    expect.assertions(1)

    const processesLimit = promiseLimit(0)

    const delay = (): Promise<unknown> =>
      new Promise((resolve) => setTimeout(resolve, 25))

    const now = Date.now()

    // All promises must run immediately.
    await Promise.all([
      processesLimit(() => delay()),
      processesLimit(() => delay()),
      processesLimit(() => delay()),
    ])

    // The total time should be lower than 50ms.
    expect(Date.now() - now).toBeLessThan(50)
  })

  it("cache enabled (mock function-only)", () => {
    expect(cacheEnabled()).toBe(true)
  })

  it("fetchLite: access to NPM Registry (advisories)", async () => {
    expect.assertions(1)

    const fetchSuccess = await fetchLite(
      "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
      "post",
      undefined,
      { "npm-outdated": ["2.0.3"] }
    )

    expect(fetchSuccess).toStrictEqual({})
  })

  it("fetchLite: access to NPM Registry (package)", async () => {
    expect.assertions(1)

    const fetchSuccess = await fetchLite(
      "https://registry.npmjs.org/node-fetch",
      undefined,
      { Accept: "application/vnd.npm.install-v1+json" }
    )

    expect(fetchSuccess).toStrictEqual({})
  })
})
