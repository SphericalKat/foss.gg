import type { Context } from "hono";

import type { Session } from "../../domain/session";
import { loadAdminPage } from "../../services/admin";
import { authenticate } from "../../services/authentication";
import { addLink, editLink, removeLink } from "../../services/links";
import { addUser } from "../../services/users";
import adminScript from "../../views/admin.client.js";
import type { AppBindings } from "../bindings";
import { clearSessionCookie, createSessionCookie } from "../middleware/session";
import {
  readCredentials,
  readFormData,
  readLinkRequest,
} from "../requests/forms";
import { redirectResponse, textResponse } from "../responses/basic";
import { renderAdminPage, renderLogin } from "../responses/html";

export const serveAdminScript = (): Response =>
  new Response(adminScript, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/javascript; charset=UTF-8",
    },
  });

const listPage = async (
  context: Context<AppBindings>,
  session: Session,
  error?: string,
  status: 200 | 400 | 409 = 200
): Promise<Response> => {
  try {
    const data = await loadAdminPage(context.env.DB, session.isAdmin);
    context.status(status);
    return renderAdminPage(context, {
      ...data,
      error,
      now: Date.now(),
      session,
    });
  } catch {
    return textResponse("Internal server error", 500);
  }
};

export const showAdmin = (
  context: Context<AppBindings>
): Response | Promise<Response> => {
  const session = context.get("session");
  return session ? listPage(context, session) : renderLogin(context);
};

export const login = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const form = await readFormData(context.req.raw);
  if (!form) {
    return renderLogin(context, "Invalid form data", 400);
  }
  const { password, username } = readCredentials(form);
  const token = await authenticate(
    context.env.DB,
    context.env.ADMIN_PASSWORD,
    username,
    password
  );
  return token
    ? redirectResponse("/admin", createSessionCookie(token))
    : renderLogin(context, "Invalid username or password", 401);
};

export const logout = (): Response =>
  redirectResponse("/admin", clearSessionCookie());

export const createLink = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const session = context.get("session");
  if (!session) {
    return textResponse("Not found", 404);
  }
  const input = await readLinkRequest(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }
  const result = await addLink(context.env.DB, input, session.username);
  if (result.status === "ok") {
    return redirectResponse(
      `/admin?${new URLSearchParams({ created: result.key, kind: result.kind })}`
    );
  }
  if (result.status === "conflict") {
    return listPage(context, session, result.message, 409);
  }
  if (result.status === "invalid") {
    return listPage(context, session, result.message, 400);
  }
  return textResponse("Internal server error", 500);
};

export const updateLink = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const session = context.get("session");
  if (!session) {
    return textResponse("Not found", 404);
  }
  const input = await readLinkRequest(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }
  const id = Number(context.req.param("id"));
  const result = await editLink(context.env.DB, input, session.username, id);
  if (result.status === "ok") {
    return redirectResponse(`/admin?saved=${id}`);
  }
  if (result.status === "conflict") {
    return listPage(context, session, result.message, 409);
  }
  if (result.status === "invalid") {
    return listPage(context, session, result.message, 400);
  }
  return result.status === "missing"
    ? textResponse("Not found", 404)
    : textResponse("Internal server error", 500);
};

export const deleteLink = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const session = context.get("session");
  if (!session) {
    return textResponse("Not found", 404);
  }
  const result = await removeLink(
    context.env.DB,
    session.username,
    Number(context.req.param("id"))
  );
  if (result.status === "ok") {
    return redirectResponse("/admin?deleted=1");
  }
  if (result.status === "missing") {
    return textResponse("Not found", 404);
  }
  return listPage(context, session, result.message, 400);
};

export const createUser = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const session = context.get("session");
  if (!session?.isAdmin) {
    return textResponse("Not found", 404);
  }
  const form = await readFormData(context.req.raw);
  if (!form) {
    return listPage(context, session, "Invalid form data", 400);
  }
  const { password, username } = readCredentials(form);
  const result = await addUser(context.env.DB, username, password);
  if (result.status === "ok") {
    return redirectResponse(
      `/admin?${new URLSearchParams({ user: username })}`
    );
  }
  if (result.status === "invalid") {
    return listPage(context, session, result.message, 400);
  }
  if (result.status === "conflict") {
    return listPage(context, session, result.message, 409);
  }
  return textResponse("Internal server error", 500);
};

export const adminNotFound = (): Response => textResponse("Not found", 404);
