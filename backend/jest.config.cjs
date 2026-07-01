const { createDefaultEsmPreset } = require("ts-jest");

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  ...createDefaultEsmPreset(),
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@generated/(.*)$": "<rootDir>/generated/$1",
  },
};
