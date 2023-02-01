/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  extensionsToTreatAsEsm: [".ts"],
  maxConcurrency: 20,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  modulePathIgnorePatterns: ["/out/"],
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        diagnostics: {
          ignoreCodes: ["TS151001"],
        },
        isolatedModules: true,
        useESM: true,
      },
    ],
  },
}
