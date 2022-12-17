/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  maxConcurrency: 20,
  modulePathIgnorePatterns: ["/out/"],
  preset: "ts-jest",
  testEnvironment: "node",
}
