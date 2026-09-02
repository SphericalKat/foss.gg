import { Hono } from "hono";
import type { Context } from "hono";

import {
  authenticate,
  clearSessionCookie,
  createPasswordCredentials,
  isUsername,
  loadSession,
} from "../session";
import type { AppBindings, Session } from "../session";
import { AdminPage } from "../views/admin";
import type { AuditEntry, Link, UserSummary } from "../views/admin";
import { LoginPage } from "../views/login";

interface LinkInput {
  kind: Link["kind"];
  key: string;
  destination: string;
}

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.use("*", loadSession);

adminRoutes.get("/", async (context) => {
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
  if (!isUsername(username) || password.length > 256) {
    return renderLogin(context, "Invalid username or password", 401);
  }

  const cookie = await authenticate(context.env, username, password);
  return cookie
    ? redirectResponse("/admin", cookie)
    : renderLogin(context, "Invalid username or password", 401);
});

adminRoutes.use("*", async (context, next) => {
  if (!context.get("session")) {
    return renderLogin(context);
  }
  await next();
});

adminRoutes.post("/logout", () => redirectResponse("/admin", clearSessionCookie()));

adminRoutes.post("/links", (context) => createLink(context, context.get("session")!));

adminRoutes.post("/users", (context) => {
  const session = context.get("session")!;
  return session.isAdmin ? createUser(context, session) : textResponse("Not found", 404);
});

adminRoutes.post("/links/:id{[0-9]+}", (context) =>
  updateLink(context, context.get("session")!, Number(context.req.param("id"))),
);

adminRoutes.post("/links/:id{[0-9]+}/delete", (context) =>
  deleteLink(context.env, context.get("session")!, Number(context.req.param("id"))),
);

adminRoutes.all("*", () => textResponse("Not found", 404));

async function createLink(context: Context<AppBindings>, session: Session): Promise<Response> {
  const input = await readLinkInput(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }

  const now = new Date().toISOString();
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        "INSERT INTO links (kind, key, destination, owner_username, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
      ).bind(input.kind, input.key, input.destination, session.username, now),
      context.env.DB.prepare(
        "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) VALUES (?1, 'created', ?2, ?3, ?4, ?5)",
      ).bind(session.username, input.kind, input.key, input.destination, now),
    ]);
    return redirectResponse("/admin");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return listPage(context, session, "That short link already exists", 409);
    }
    return textResponse("Internal server error", 500);
  }
}

async function updateLink(
  context: Context<AppBindings>,
  session: Session,
  id: number,
): Promise<Response> {
  const input = await readLinkInput(context.req.raw);
  if ("error" in input) {
    return listPage(context, session, input.error, 400);
  }

  const now = new Date().toISOString();
  try {
    const [result] = await context.env.DB.batch([
      context.env.DB.prepare(
        "UPDATE links SET kind = ?1, key = ?2, destination = ?3, updated_at = ?4 WHERE id = ?5 AND owner_username = ?6",
      ).bind(input.kind, input.key, input.destination, now, id, session.username),
      context.env.DB.prepare(
        "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) SELECT ?1, 'updated', kind, key, destination, ?2 FROM links WHERE id = ?3 AND owner_username = ?1",
      ).bind(session.username, now, id),
    ]);
    if (!result.meta.changes) {
      return textResponse("Not found", 404);
    }
    return redirectResponse("/admin");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return listPage(context, session, "That short link already exists", 409);
    }
    return textResponse("Internal server error", 500);
  }
}

async function deleteLink(env: Env, session: Session, id: number): Promise<Response> {
  const now = new Date().toISOString();
  const [, result] = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) SELECT ?1, 'deleted', kind, key, destination, ?2 FROM links WHERE id = ?3 AND owner_username = ?1",
    ).bind(session.username, now, id),
    env.DB.prepare("DELETE FROM links WHERE id = ?1 AND owner_username = ?2").bind(
      id,
      session.username,
    ),
  ]);
  if (!result.meta.changes) {
    return textResponse("Not found", 404);
  }
  return redirectResponse("/admin");
}

async function createUser(context: Context<AppBindings>, session: Session): Promise<Response> {
  const form = await readFormData(context.req.raw);
  if (!form) {
    return listPage(context, session, "Invalid form data", 400);
  }
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!isUsername(username) || username === "admin") {
    return listPage(context, session, "Enter a valid username", 400);
  }
  if (password.length < 12 || password.length > 256) {
    return listPage(context, session, "Passwords must contain 12 to 256 characters", 400);
  }

  const credentials = await createPasswordCredentials(password);
  try {
    await context.env.DB.prepare(
      "INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?1, ?2, ?3, ?4)",
    )
      .bind(username, credentials.hash, credentials.salt, new Date().toISOString())
      .run();
    return redirectResponse("/admin");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return listPage(context, session, "That username already exists", 409);
    }
    return textResponse("Internal server error", 500);
  }
}

async function readLinkInput(request: Request): Promise<LinkInput | { error: string }> {
  const form = await readFormData(request);
  if (!form) {
    return { error: "Invalid form data" };
  }
  const rawKind = String(form.get("kind") ?? "");
  const rawKey = String(form.get("key") ?? "").trim();
  const destination = String(form.get("destination") ?? "").trim();
  if (rawKind !== "path" && rawKind !== "subdomain") {
    return { error: "Choose a valid link type" };
  }
  if (!rawKey) {
    return { error: "Enter a valid short-link key" };
  }
  const kind = rawKind as Link["kind"];
  const key = kind === "path" ? normalizePathKey(rawKey) : rawKey.toLowerCase();
  if (!key || (kind === "path" ? !isPathKey(key) : !isSubdomainKey(key))) {
    return { error: "Enter a valid short-link key" };
  }
  if (kind === "path" && (key === "/" || key === "/admin" || key.startsWith("/admin/"))) {
    return { error: "The root and /admin routes are reserved" };
  }
  if (!isDestination(destination)) {
    return { error: "Destination must be an absolute HTTP or HTTPS URL" };
  }
  return { destination, key, kind };
}

async function readFormData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

function normalizePathKey(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function isPathKey(value: string): boolean {
  return (
    value.length <= 2048 && /^\/[\S]*$/.test(value) && !value.includes("?") && !value.includes("#")
  );
}

function isSubdomainKey(value: string): boolean {
  return value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function isDestination(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

async function listPage(
  context: Context<AppBindings>,
  session: Session,
  error?: string,
  status: 200 | 400 | 409 = 200,
): Promise<Response> {
  try {
    const [links, audit, users] = await Promise.all([
      context.env.DB.prepare(
        "SELECT id, kind, key, destination, owner_username, created_at, updated_at FROM links ORDER BY kind, key",
      ).all<Link>(),
      context.env.DB.prepare(
        // ponytail: Show recent activity only; add pagination when 100 entries are not enough.
        "SELECT id, actor_username, action, kind, key, destination, created_at FROM audit_log ORDER BY id DESC LIMIT 100",
      ).all<AuditEntry>(),
      session.isAdmin
        ? context.env.DB.prepare(
            "SELECT username, created_at FROM users ORDER BY username",
          ).all<UserSummary>()
        : Promise.resolve({ results: [] as UserSummary[] }),
    ]);
    context.status(status);
    return context.render(
      <AdminPage
        links={links.results}
        audit={audit.results}
        users={users.results}
        session={session}
        error={error}
      />,
    );
  } catch {
    return textResponse("Internal server error", 500);
  }
}

async function renderLogin(
  context: Context<AppBindings>,
  error?: string,
  status: 200 | 400 | 401 = 200,
): Promise<Response> {
  context.status(status);
  return context.render(<LoginPage error={error} />);
}

function redirectResponse(location: string, setCookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
  });
  if (setCookie) {
    headers.set("Set-Cookie", setCookie);
  }
  return new Response(null, { headers, status: 303 });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
    status,
  });
}
