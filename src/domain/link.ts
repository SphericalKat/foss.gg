import { isSubdomainLabel, splitSubdomainKey } from "./subdomain-key";

export type LinkKind = "path" | "subdomain";

export interface Link {
  id: number;
  kind: LinkKind;
  key: string;
  destination: string;
  owner_username: string;
  created_at: string;
  updated_at: string;
}

export interface LinkInput {
  kind: LinkKind;
  key: string;
  destination: string;
}

export interface AuditEntry {
  id: number;
  actor_username: string;
  action: "created" | "updated" | "deleted";
  kind: LinkKind;
  key: string;
  destination: string;
  created_at: string;
}

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

export const isSubdomainParent = (link: Link): boolean =>
  link.kind === "subdomain" && !splitSubdomainKey(link.key).path;

export const isSubdomainChildPath = (link: Link): boolean =>
  link.kind === "subdomain" && Boolean(splitSubdomainKey(link.key).path);

export const hasChildPaths = (link: Link, links: Link[]): boolean => {
  if (!isSubdomainParent(link)) {
    return false;
  }
  const { label } = splitSubdomainKey(link.key);
  return links.some(
    (candidate) =>
      isSubdomainChildPath(candidate) &&
      splitSubdomainKey(candidate.key).label === label
  );
};

export const ownedParentLabels = (
  links: Link[],
  username: string
): string[] => [
  ...new Set(
    links
      .filter(
        (link) => isSubdomainParent(link) && link.owner_username === username
      )
      .map((link) => splitSubdomainKey(link.key).label)
  ),
];
