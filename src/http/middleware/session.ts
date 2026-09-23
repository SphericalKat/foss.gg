import type { MiddlewareHandler } from "hono";

import { SESSION_TTL_SECONDS } from "../../domain/session";
import { getSession } from "../../services/authentication";
import type { AppBindings } from "../bindings";
import { renderLogin } from "../responses/html";

const SESSION_COOKIE = "foss_admin_session";

export const createSessionCookie = (token: string): string =>
  `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/admin; HttpOnly; Secure; SameSite=Lax`;

export const clearSessionCookie = (): string =>
  `${SESSION_COOKIE}=; Max-Age=0; Path=/admin; HttpOnly; Secure; SameSite=Lax`;

export const loadSession: MiddlewareHandler<AppBindings> = async (
  context,
  next
) => {
  const cookieHeader = context.req.header("Cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  context.set(
    "session",
    token
      ? await getSession(token, context.env.DB, context.env.ADMIN_PASSWORD)
      : null
  );
  return await next();
};

export const requireSession: MiddlewareHandler<AppBindings> = async (
  context,
  next
) => {
  if (!context.get("session")) {
    return renderLogin(context);
  }
  return await next();
};
