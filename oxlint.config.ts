import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";
import antiSlop from "ultracite/oxlint/anti-slop";

export default defineConfig({
  extends: [core, next, react, vitest, antiSlop],
  ignorePatterns: core.ignorePatterns,
});
