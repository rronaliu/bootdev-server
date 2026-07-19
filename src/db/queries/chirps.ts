import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { NewChirp, chirps } from "../../schema.js";

export async function createChirp(chirp: NewChirp) {
  const [result] = await db.insert(chirps).values(chirp).returning();
  return result;
}

export async function getAllChirps() {
  return db.select().from(chirps);
}

export async function getChirpById(id: string) {
  const [chirp] = await db.select().from(chirps).where(eq(chirps.id, id));
  return chirp;
}
