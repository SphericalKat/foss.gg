import type { UserSummary } from "../domain/user";
import { isUniqueConstraintError } from "./errors";

interface UserRecord {
  username: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

export const listUsers = async (db: D1Database): Promise<UserSummary[]> => {
  const result = await db
    .prepare("SELECT username, created_at FROM users ORDER BY username")
    .all<UserSummary>();
  return result.results;
};

export const findUserRecord = (
  db: D1Database,
  username: string
): Promise<UserRecord | null> =>
  db
    .prepare(
      "SELECT username, password_hash, password_salt, created_at FROM users WHERE username = ?1"
    )
    .bind(username)
    .first<UserRecord>();

export const userExists = async (
  db: D1Database,
  username: string
): Promise<boolean> => {
  const row = await db
    .prepare("SELECT username FROM users WHERE username = ?1")
    .bind(username)
    .first();
  return Boolean(row);
};

export const insertUser = async (
  db: D1Database,
  username: string,
  passwordHash: string,
  passwordSalt: string,
  createdAt: string
): Promise<"ok" | "conflict"> => {
  try {
    await db
      .prepare(
        "INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?1, ?2, ?3, ?4)"
      )
      .bind(username, passwordHash, passwordSalt, createdAt)
      .run();
    return "ok";
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return "conflict";
    }
    throw error;
  }
};
