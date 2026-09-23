import { isSubdomainLabel, splitSubdomainKey } from "../subdomain-key";
import type { AuditEntry, Link, LinkInput, LinkKind } from "../types";
import { isUniqueConstraintError } from "./errors";

type AddLinkResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "failure" };

type EditLinkResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "missing" }
  | { status: "failure" };

type RemoveLinkResult =
  | { status: "ok" }
  | { status: "missing" }
  | { status: "invalid"; message: string };

const isDestination = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
};

const isPathKey = (value: string): boolean =>
  value.length <= 2048 &&
  /^\/[\S]*$/u.test(value) &&
  !value.includes("?") &&
  !value.includes("#");

const normalizePathKey = (value: string): string =>
  value.startsWith("/") ? value : `/${value}`;

const normalizeSubdomainKey = (value: string): string => {
  const { label, path } = splitSubdomainKey(value);
  if (!isSubdomainLabel(label)) {
    return "";
  }
  if (!path) {
    return label;
  }
  const normalizedPath = normalizePathKey(path).replace(/\/+$/u, "");
  return isPathKey(normalizedPath) ? `${label}${normalizedPath}` : "";
};

export const validateLinkInput = (
  rawKind: string,
  rawKey: string,
  destination: string
): LinkInput | { error: string } => {
  if (rawKind !== "path" && rawKind !== "subdomain") {
    return { error: "Choose a valid link type" };
  }
  if (!rawKey) {
    return { error: "Enter a valid short-link key" };
  }
  // SAFETY: The checks above narrow rawKind to "path" or "subdomain", the only Link["kind"] values.
  const kind = rawKind as LinkKind;
  const key =
    kind === "path" ? normalizePathKey(rawKey) : normalizeSubdomainKey(rawKey);
  if (!key || (kind === "path" && !isPathKey(key))) {
    return { error: "Enter a valid short-link key" };
  }
  if (
    kind === "path" &&
    (key === "/" || key === "/admin" || key.startsWith("/admin/"))
  ) {
    return { error: "The root and /admin routes are reserved" };
  }
  if (!isDestination(destination)) {
    return { error: "Destination must be an absolute HTTP or HTTPS URL" };
  }
  return { destination, key, kind };
};

const ensureSubdomainParentExists = async (
  db: D1Database,
  key: string,
  username: string,
  excludeId?: number
): Promise<string | null> => {
  const { label: parent, path } = splitSubdomainKey(key);
  if (!path) {
    return null;
  }
  const row = excludeId
    ? await db
        .prepare(
          "SELECT owner_username FROM links WHERE kind = ?1 AND key = ?2 AND id != ?3"
        )
        .bind("subdomain", parent, excludeId)
        .first<{ owner_username: string }>()
    : await db
        .prepare(
          "SELECT owner_username FROM links WHERE kind = ?1 AND key = ?2"
        )
        .bind("subdomain", parent)
        .first<{ owner_username: string }>();
  if (!row) {
    return `Create ${parent}.foss.gg first`;
  }
  return row.owner_username === username
    ? null
    : `You don't own ${parent}.foss.gg`;
};

const countChildPaths = async (
  db: D1Database,
  parent: string
): Promise<number> => {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS total FROM links WHERE kind = ?1 AND key LIKE ?2"
    )
    .bind("subdomain", `${parent}/%`)
    .first<{ total: number }>();
  return row?.total ?? 0;
};

export const listLinks = async (db: D1Database): Promise<Link[]> => {
  const result = await db
    .prepare(
      "SELECT id, kind, key, destination, owner_username, created_at, updated_at FROM links ORDER BY kind, key"
    )
    .all<Link>();
  return result.results;
};

export const listAuditEntries = async (
  db: D1Database
): Promise<AuditEntry[]> => {
  const result = await db
    .prepare(
      // ponytail: Show recent activity only; add pagination when 100 entries are not enough.
      "SELECT id, actor_username, action, kind, key, destination, created_at FROM audit_log ORDER BY id DESC LIMIT 100"
    )
    .all<AuditEntry>();
  return result.results;
};

export const addLink = async (
  db: D1Database,
  input: LinkInput,
  username: string
): Promise<AddLinkResult> => {
  if (input.kind === "subdomain") {
    const parentError = await ensureSubdomainParentExists(
      db,
      input.key,
      username
    );
    if (parentError) {
      return { message: parentError, status: "invalid" };
    }
  }

  const now = new Date().toISOString();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO links (kind, key, destination, owner_username, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)"
        )
        .bind(input.kind, input.key, input.destination, username, now),
      db
        .prepare(
          "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) VALUES (?1, 'created', ?2, ?3, ?4, ?5)"
        )
        .bind(username, input.kind, input.key, input.destination, now),
    ]);
    return { status: "ok" };
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return { message: "That short link already exists", status: "conflict" };
    }
    return { status: "failure" };
  }
};

export const editLink = async (
  db: D1Database,
  input: LinkInput,
  username: string,
  id: number
): Promise<EditLinkResult> => {
  const existing = await db
    .prepare(
      "SELECT kind, key FROM links WHERE id = ?1 AND owner_username = ?2"
    )
    .bind(id, username)
    .first<{ kind: LinkKind; key: string }>();
  if (!existing) {
    return { status: "missing" };
  }
  const renamedParent =
    existing.kind === "subdomain" &&
    !existing.key.includes("/") &&
    (input.kind !== "subdomain" || input.key !== existing.key);
  if (renamedParent && (await countChildPaths(db, existing.key)) > 0) {
    return {
      message: `Delete ${existing.key} paths first`,
      status: "invalid",
    };
  }
  if (input.kind === "subdomain") {
    const parentError = await ensureSubdomainParentExists(
      db,
      input.key,
      username,
      id
    );
    if (parentError) {
      return { message: parentError, status: "invalid" };
    }
  }

  const now = new Date().toISOString();
  try {
    const [result] = await db.batch([
      db
        .prepare(
          "UPDATE links SET kind = ?1, key = ?2, destination = ?3, updated_at = ?4 WHERE id = ?5 AND owner_username = ?6"
        )
        .bind(input.kind, input.key, input.destination, now, id, username),
      db
        .prepare(
          "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) SELECT ?1, 'updated', kind, key, destination, ?2 FROM links WHERE id = ?3 AND owner_username = ?1"
        )
        .bind(username, now, id),
    ]);
    if (!result.meta.changes) {
      return { status: "missing" };
    }
    return { status: "ok" };
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return { message: "That short link already exists", status: "conflict" };
    }
    return { status: "failure" };
  }
};

export const removeLink = async (
  db: D1Database,
  username: string,
  id: number
): Promise<RemoveLinkResult> => {
  const existing = await db
    .prepare(
      "SELECT kind, key FROM links WHERE id = ?1 AND owner_username = ?2"
    )
    .bind(id, username)
    .first<{ kind: LinkKind; key: string }>();
  if (!existing) {
    return { status: "missing" };
  }
  if (
    existing.kind === "subdomain" &&
    !existing.key.includes("/") &&
    (await countChildPaths(db, existing.key)) > 0
  ) {
    return {
      message: `Delete ${existing.key} paths first`,
      status: "invalid",
    };
  }

  const now = new Date().toISOString();
  const [, result] = await db.batch([
    db
      .prepare(
        "INSERT INTO audit_log (actor_username, action, kind, key, destination, created_at) SELECT ?1, 'deleted', kind, key, destination, ?2 FROM links WHERE id = ?3 AND owner_username = ?1"
      )
      .bind(username, now, id),
    db
      .prepare("DELETE FROM links WHERE id = ?1 AND owner_username = ?2")
      .bind(id, username),
  ]);
  if (!result.meta.changes) {
    return { status: "missing" };
  }
  return { status: "ok" };
};

export const findLink = (
  db: D1Database,
  kind: LinkKind,
  key: string
): Promise<Pick<Link, "destination"> | null> =>
  db
    .prepare("SELECT destination FROM links WHERE kind = ?1 AND key = ?2")
    .bind(kind, key)
    .first<Pick<Link, "destination">>();
