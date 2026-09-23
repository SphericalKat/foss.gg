import { isUsername } from "../domain/user";
import { insertUser } from "../repositories/users";
import { hashPassword } from "../security/passwords";

type UserWriteResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "failure" };

export const addUser = async (
  db: D1Database,
  username: string,
  password: string
): Promise<UserWriteResult> => {
  if (!isUsername(username) || username === "admin") {
    return { message: "Enter a valid username", status: "invalid" };
  }
  if (password.length < 12 || password.length > 256) {
    return {
      message: "Passwords must contain 12 to 256 characters",
      status: "invalid",
    };
  }

  const credentials = await hashPassword(password);
  try {
    const status = await insertUser(
      db,
      username,
      credentials.hash,
      credentials.salt,
      new Date().toISOString()
    );
    return status === "conflict"
      ? { message: "That username already exists", status }
      : { status: "ok" };
  } catch {
    return { status: "failure" };
  }
};
