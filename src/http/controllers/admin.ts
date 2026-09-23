import type { Context } from "hono";

import type { Link } from "../../domain/link";
import type { Session } from "../../domain/session";
import { splitSubdomainKey } from "../../domain/subdomain-key";
import { loadAdminPage } from "../../services/admin";
import { authenticate } from "../../services/authentication";
import { addLink, editLink, removeLink } from "../../services/links";
import { addUser } from "../../services/users";
import type { ErrorContext, LinkDraft } from "../../views/admin";
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

interface ListPageOptions {
  error?: string;
  status?: 200 | 400 | 409;
  draft?: LinkDraft;
  errorContext?: ErrorContext;
}

const errorField = (message: string): "address" | "destination" | undefined => {
  if (message === "Destination must be an absolute HTTP or HTTPS URL") {
    return "destination";
  }
  if (
    message === "Choose a valid link type" ||
    message === "Enter a valid short-link key" ||
    message === "The root and /admin routes are reserved" ||
    message === "That short link already exists" ||
    message.startsWith("Create ") ||
    message.startsWith("You don't own ") ||
    message.startsWith("Delete ")
  ) {
    return "address";
  }
  return undefined;
};

const ownedPrefillDomain = (
  links: Link[],
  requested: string | undefined,
  username: string
): string | undefined => {
  if (!requested) {
    return undefined;
  }
  return links.some(
    (link) =>
      link.kind === "subdomain" &&
      link.owner_username === username &&
      !splitSubdomainKey(link.key).path &&
      splitSubdomainKey(link.key).label === requested.toLowerCase()
  )
    ? requested.toLowerCase()
    : undefined;
};

const listPage = async (
  context: Context<AppBindings>,
  session: Session,
  options: ListPageOptions = {}
): Promise<Response> => {
  try {
    const data = await loadAdminPage(context.env.DB, session.isAdmin);
    context.status(options.status ?? 200);
    return renderAdminPage(context, {
      ...data,
      draft: options.draft,
      error: options.error,
      errorContext: options.errorContext,
      now: Date.now(),
      prefillDomain: ownedPrefillDomain(
        data.links,
        context.req.query("domain"),
        session.username
      ),
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
    return listPage(context, session, {
      error: input.error,
      errorContext: { operation: "create" },
      status: 400,
    });
  }
  const result = await addLink(context.env.DB, input, session.username);
  if (result.status === "ok") {
    return redirectResponse(
      `/admin?${new URLSearchParams({ created: result.key, kind: result.kind })}`
    );
  }
  if (result.status === "conflict") {
    return listPage(context, session, {
      draft: input,
      error: result.message,
      errorContext: {
        field: errorField(result.message),
        operation: "create",
      },
      status: 409,
    });
  }
  if (result.status === "invalid") {
    return listPage(context, session, {
      draft: input,
      error: result.message,
      errorContext: {
        field: errorField(result.message),
        operation: "create",
      },
      status: 400,
    });
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
    return listPage(context, session, {
      error: input.error,
      errorContext: {
        linkId: Number(context.req.param("id")),
        operation: "edit",
      },
      status: 400,
    });
  }
  const id = Number(context.req.param("id"));
  const result = await editLink(context.env.DB, input, session.username, id);
  if (result.status === "ok") {
    return redirectResponse(`/admin?saved=${id}`);
  }
  if (result.status === "conflict") {
    return listPage(context, session, {
      draft: input,
      error: result.message,
      errorContext: {
        field: errorField(result.message),
        linkId: id,
        operation: "edit",
      },
      status: 409,
    });
  }
  if (result.status === "invalid") {
    return listPage(context, session, {
      draft: input,
      error: result.message,
      errorContext: {
        field: errorField(result.message),
        linkId: id,
        operation: "edit",
      },
      status: 400,
    });
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
  return listPage(context, session, {
    error: result.message,
    status: 400,
  });
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
    return listPage(context, session, {
      error: "Invalid form data",
      status: 400,
    });
  }
  const { password, username } = readCredentials(form);
  const result = await addUser(context.env.DB, username, password);
  if (result.status === "ok") {
    return redirectResponse(
      `/admin?${new URLSearchParams({ user: username })}`
    );
  }
  if (result.status === "invalid") {
    return listPage(context, session, { error: result.message, status: 400 });
  }
  if (result.status === "conflict") {
    return listPage(context, session, { error: result.message, status: 409 });
  }
  return textResponse("Internal server error", 500);
};

export const adminNotFound = (): Response => textResponse("Not found", 404);
