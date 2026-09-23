import { SESSION_TTL_SECONDS } from "../domain/session";
import type { Session } from "../domain/session";
import { isUsername } from "../domain/user";
import { findUserRecord, userExists } from "../repositories/users";
import { verifyPassword } from "../security/passwords";
import { timingSafeStringEqual } from "../security/primitives";
import {
  createSessionToken,
  readSessionToken,
} from "../security/session-tokens";

const validCredentials = async (
  db: D1Database,
  adminPassword: string,
  username: string,
  password: string
): Promise<boolean> => {
  if (username === "admin") {
    return (
      Boolean(adminPassword) && timingSafeStringEqual(password, adminPassword)
    );
  }
  const user = await findUserRecord(db, username);
  if (!user) {
    return false;
  }
  return verifyPassword(password, user.password_salt, user.password_hash);
};

export const authenticate = async (
  db: D1Database,
  adminPassword: string,
  username: string,
  password: string
): Promise<string | null> => {
  if (!isUsername(username) || password.length > 256) {
    return null;
  }
  if (!(await validCredentials(db, adminPassword, username, password))) {
    return null;
  }
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return createSessionToken(username, expires, adminPassword);
};

export const getSession = async (
  token: string,
  db: D1Database,
  adminPassword: string
): Promise<Session | null> => {
  if (!adminPassword) {
    return null;
  }
  const username = await readSessionToken(token, adminPassword);
  if (!username || !isUsername(username)) {
    return null;
  }
  if (username !== "admin" && !(await userExists(db, username))) {
    return null;
  }
  return { isAdmin: username === "admin", username };
};
