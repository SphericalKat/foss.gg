import { validateLinkInput } from "../domain/link";
import type { Link, LinkKind } from "../domain/link";
import { splitSubdomainKey } from "../domain/subdomain-key";
import {
  countChildPaths,
  deleteLinkWithAudit,
  findDestination,
  findOwnedLink,
  findSubdomainOwner,
  insertLinkWithAudit,
  updateLinkWithAudit,
} from "../repositories/links";

export interface LinkRequest {
  kind: string;
  key: string;
  destination: string;
}

type AddLinkResult =
  | { status: "ok"; key: string; kind: LinkKind }
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

const ensureParentExists = async (
  db: D1Database,
  key: string,
  username: string,
  excludeId?: number
): Promise<string | null> => {
  const { label: parent, path } = splitSubdomainKey(key);
  if (!path) {
    return null;
  }
  const owner = await findSubdomainOwner(db, parent, excludeId);
  if (!owner) {
    return `Create ${parent}.foss.gg first`;
  }
  return owner === username ? null : `You don't own ${parent}.foss.gg`;
};

export const addLink = async (
  db: D1Database,
  request: LinkRequest,
  username: string
): Promise<AddLinkResult> => {
  const input = validateLinkInput(
    request.kind,
    request.key,
    request.destination
  );
  if ("error" in input) {
    return { message: input.error, status: "invalid" };
  }
  if (input.kind === "subdomain") {
    const parentError = await ensureParentExists(db, input.key, username);
    if (parentError) {
      return { message: parentError, status: "invalid" };
    }
  }

  const now = new Date().toISOString();
  try {
    const status = await insertLinkWithAudit(db, input, username, now);
    if (status === "conflict") {
      return { message: "That short link already exists", status };
    }
    return { key: input.key, kind: input.kind, status: "ok" };
  } catch {
    return { status: "failure" };
  }
};

export const editLink = async (
  db: D1Database,
  request: LinkRequest,
  username: string,
  id: number
): Promise<EditLinkResult> => {
  const input = validateLinkInput(
    request.kind,
    request.key,
    request.destination
  );
  if ("error" in input) {
    return { message: input.error, status: "invalid" };
  }
  const existing = await findOwnedLink(db, id, username);
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
    const parentError = await ensureParentExists(db, input.key, username, id);
    if (parentError) {
      return { message: parentError, status: "invalid" };
    }
  }

  const now = new Date().toISOString();
  try {
    const result = await updateLinkWithAudit(db, input, username, id, now);
    if (result.status === "conflict") {
      return { message: "That short link already exists", status: "conflict" };
    }
    if (!result.changes) {
      return { status: "missing" };
    }
    return { status: "ok" };
  } catch {
    return { status: "failure" };
  }
};

export const removeLink = async (
  db: D1Database,
  username: string,
  id: number
): Promise<RemoveLinkResult> => {
  const existing = await findOwnedLink(db, id, username);
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
  const changes = await deleteLinkWithAudit(db, username, id, now);
  if (!changes) {
    return { status: "missing" };
  }
  return { status: "ok" };
};

export const resolveLink = async (
  db: D1Database,
  kind: LinkKind,
  key: string,
  fallbackKey: string | null
): Promise<Pick<Link, "destination"> | null> => {
  const link = await findDestination(db, kind, key);
  return link ?? (fallbackKey ? findDestination(db, kind, fallbackKey) : null);
};
