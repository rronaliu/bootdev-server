import { db } from "../index.js";
import { NewUser, users } from "../../schema.js";
import { asc } from "drizzle-orm";

export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function deleteAllUsers() {
  await db.delete(users).execute();
}

export async function getAllUsers() {
  const result = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt))
    .execute();
  return result;
}
