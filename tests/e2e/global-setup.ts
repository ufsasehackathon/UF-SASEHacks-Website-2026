import { loadTestEnv } from "../setup/env";
import { prepareDatabase } from "../setup/schema";

export default async function globalSetup() {
  await prepareDatabase(loadTestEnv());
}
