module.exports = async () => {
  return {
    rootDir: "./",
    verbose: true,
    transform: {
      "^.+\\.ts?$": "ts-jest",
      "^.+\\.js?$": "babel-jest",
    },
    transformIgnorePatterns: [
      "node_modules/(?!(sc-base-database|sc-common|sc-game-base|sc-base-apis|sc-api-client|jest-auto-fixture|nanoid|crypto-random-string|sc-game-service-integration-utils|sc-game-management-client|prom-client)/.*)",
    ],
    preset: "ts-jest",
    testEnvironment: "node",
    testResultsProcessor: "jest-sonar-reporter",
    reporters: ["default", ["jest-junit", { outputDirectory: "coverage", outputName: "unit-tests.xml" }]],
    coverageReporters: ["clover", "lcov", "text-summary", "cobertura"],
    coverageDirectory: "coverage",

    collectCoverageFrom: [
      "src/**/*.{js,jsx,ts,tsx}",
      "!src/**/*.d.ts",
      "!**/node_modules/**",
      "!**/vendor/**",
      "!**/tests/**",
    ],
  };
};
