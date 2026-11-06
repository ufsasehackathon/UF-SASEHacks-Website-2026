import type { TestProject } from "vitest/node";
import { loadTestEnv, type TestEnv } from "./env";
import { prepareDatabase } from "./schema";

declare module "vitest" {
  export interface ProvidedContext {
    testEnv: TestEnv;
  }
}

export default async function setup(project: TestProject) {
  const env = loadTestEnv();
  await prepareDatabase(env);
  project.provide("testEnv", env);
}
