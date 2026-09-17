import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

// One physical file for the whole app. See CLAUDE.md §4 — expo-sqlite +
// Drizzle, no server, everything local to the device.
const expoDb = openDatabaseSync("lyfr.db", { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });
