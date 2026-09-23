import { Hono } from "hono";
import type { Context } from "hono";

import type { AppBindings } from "../bindings";
import {
  addLink,
  editLink,
  removeLink,
  validateLinkInput,
} from "../models/links";
import { addUser, authenticate } from "../models/users";
import type { LinkInput, Session } from "../types";
import adminScript from "../views/admin.client.js";
import { listPage, renderLogin } from "./admin-responses";
import {
  clearSessionCookie,
  createSessionCookie,
  loadSession,
} from "./session";

const textResponse = (body: string, status: number): Response =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
    status,
  });

const readFormData = async (request: Request): Promise<FormData | null> => {
  try {
    return await request.formData();
  } catch {
    return null;
  }
};

const redirectResponse = (location: string, setCookie?: string): Response => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
  });
  if (setCookie) {
    headers.set("Set-Cookie", setCookie);
  }
  return new Response(null, { headers, status: 303 });
};

const readLinkInput = async (
  request: Request
): Promise<LinkInput | { error: string }> => {
  const form = await readFormData(request);
  if (!form) {
    return { error: "Invalid form data" };
  }
  const rawKind = String(form.get("kind") ?? "");
  const rawKey = String(form.get("key") ?? "").trim();
  const destination = String(form.get("destination") ?? "").trim();
  return validateLinkInput(rawKind, rawKey, destination);
};

const createLink = async (
  context: Context<AppBindings>,
  session: Session
): Promise<Response> => {
  const input = await readLinkInput(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }
  const result = await addLink(context.env.DB, input, session.username);
  if (result.status === "ok") {
    return redirectResponse(
      `/admin?${new URLSearchParams({ created: input.key, kind: input.kind })}`
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

const updateLink = async (
  context: Context<AppBindings>,
  session: Session,
  id: number
): Promise<Response> => {
  const input = await readLinkInput(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }
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

const deleteLink = async (
  context: Context<AppBindings>,
  session: Session,
  id: number
): Promise<Response> => {
  const result = await removeLink(context.env.DB, session.username, id);
  if (result.status === "ok") {
    return redirectResponse("/admin?deleted=1");
  }
  if (result.status === "missing") {
    return textResponse("Not found", 404);
  }
  return listPage(context, session, result.message, 400);
};

const createUser = async (
  context: Context<AppBindings>,
  session: Session
): Promise<Response> => {
  const form = await readFormData(context.req.raw);
  if (!form) {
    return listPage(context, session, "Invalid form data", 400);
  }
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
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

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.get(
  "/admin.js",
  () =>
    new Response(adminScript, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/javascript; charset=UTF-8",
      },
    })
);

adminRoutes.use("*", loadSession);

adminRoutes.get("/", (context) => {
  const session = context.get("session");
  return session ? listPage(context, session) : renderLogin(context);
});

adminRoutes.post("/login", async (context) => {
  const form = await readFormData(context.req.raw);
  if (!form) {
    return renderLogin(context, "Invalid form data", 400);
  }
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const token = await authenticate(
    context.env.DB,
    context.env.ADMIN_PASSWORD,
    username,
    password
  );
  return token
    ? redirectResponse("/admin", createSessionCookie(token))
    : renderLogin(context, "Invalid username or password", 401);
});

adminRoutes.use("*", async (context, next) => {
  if (!context.get("session")) {
    return renderLogin(context);
  }
  return await next();
});

adminRoutes.post("/logout", () =>
  redirectResponse("/admin", clearSessionCookie())
);

adminRoutes.post("/links", (context) => {
  const session = context.get("session");
  return session
    ? createLink(context, session)
    : textResponse("Not found", 404);
});

adminRoutes.post("/users", (context) => {
  const session = context.get("session");
  return session?.isAdmin
    ? createUser(context, session)
    : textResponse("Not found", 404);
});

adminRoutes.post("/links/:id{[0-9]+}", (context) => {
  const session = context.get("session");
  return session
    ? updateLink(context, session, Number(context.req.param("id")))
    : textResponse("Not found", 404);
});

adminRoutes.post("/links/:id{[0-9]+}/delete", (context) => {
  const session = context.get("session");
  return session
    ? deleteLink(context, session, Number(context.req.param("id")))
    : textResponse("Not found", 404);
});

adminRoutes.all("*", () => textResponse("Not found", 404));
