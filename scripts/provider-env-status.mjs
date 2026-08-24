#!/usr/bin/env node
import { EVAL_ENV_KEYS, loadEvalEnvironment } from "../dist/env.js";

try {
  const result = loadEvalEnvironment();
  console.log(`credential files=${result.loadedFrom.length ? result.loadedFrom.join(",") : "NONE"}`);
  for (const name of EVAL_ENV_KEYS) {
    console.log(`${name}=${process.env[name] ? "PRESENT" : "ABSENT"}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`credential file error=${message}`);
  process.exit(2);
}
