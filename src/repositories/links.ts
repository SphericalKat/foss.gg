import type { AuditEntry, Link, LinkInput, LinkKind } from "../domain/link";
import { isUniqueConstraintError } from "./errors";

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

export const findDestination = (
  db: D1Database,
  kind: LinkKind,
  key: string
): Promise<Pick<Link, "destination"> | null> =>
  db
    .prepare("SELECT destination FROM links WHERE kind = ?1 AND key = ?2")
    .bind(kind, key)
    .first<Pick<Link, "destination">>();

export const findOwnedLink = (
  db: D1Database,
  id: number,
  username: string
): Promise<{ kind: LinkKind; key: string } | null> =>
  db
    .prepare(
      "SELECT kind, key FROM links WHERE id = ?1 AND owner_username = ?2"
    )
    .bind(id, username)
    .first<{ kind: LinkKind; key: string }>();

export const findSubdomainOwner = async (
  db: D1Database,
  parent: string,
  excludeId?: number
): Promise<string | null> => {
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
  return row?.owner_username ?? null;
};

export const countChildPaths = async (
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

export const insertLinkWithAudit = async (
  db: D1Database,
  input: LinkInput,
  username: string,
  now: string
): Promise<"ok" | "conflict"> => {
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
    return "ok";
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return "conflict";
    }
    throw error;
  }
};

export const updateLinkWithAudit = async (
  db: D1Database,
  input: LinkInput,
  username: string,
  id: number,
  now: string
): Promise<{ status: "ok"; changes: number } | { status: "conflict" }> => {
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
    return { changes: result.meta.changes, status: "ok" };
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return { status: "conflict" };
    }
    throw error;
  }
};

export const deleteLinkWithAudit = async (
  db: D1Database,
  username: string,
  id: number,
  now: string
): Promise<number> => {
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
  return result.meta.changes;
};
