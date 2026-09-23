import type { Link } from "../../domain/link";
import { splitSubdomainKey } from "../../domain/subdomain-key";
import type { LinkDraft } from "./types";

export interface NewLinkState {
  draftKind: Link["kind"];
  selectedDomain: string;
  pathValue: string | undefined;
  subdomainName: string;
  keyValue: string;
  destination: string;
}

const draftParts = (kind: Link["kind"], draft?: LinkDraft) =>
  kind === "subdomain"
    ? splitSubdomainKey(draft?.key ?? "")
    : { label: "", path: draft?.key ?? "" };

const getSelectedDomain = (
  parents: string[],
  kind: Link["kind"],
  parent: string,
  childPath: string | null,
  draft: LinkDraft | undefined,
  prefillDomain: string | undefined
): string => {
  if (kind === "subdomain" && childPath && parents.includes(parent)) {
    return `subdomain:${parent}`;
  }
  if (kind === "path") {
    return "path";
  }
  if (draft) {
    return "create";
  }
  if (prefillDomain && parents.includes(prefillDomain)) {
    return `subdomain:${prefillDomain}`;
  }
  return "path";
};

export const newLinkState = (
  parents: string[],
  draft?: LinkDraft,
  prefillDomain?: string
): NewLinkState => {
  const kind =
    draft?.kind === "subdomain" ||
    (!draft && prefillDomain && parents.includes(prefillDomain))
      ? "subdomain"
      : "path";
  const parts = draftParts(kind, draft);
  const parent = kind === "subdomain" ? parts.label : "";
  const selected = getSelectedDomain(
    parents,
    kind,
    parent,
    parts.path,
    draft,
    prefillDomain
  );
  let pathValue: string | undefined;
  if (kind === "path") {
    pathValue = draft?.key;
  } else if (parents.includes(parent)) {
    pathValue = parts.path ?? "";
  }
  return {
    destination: draft?.destination ?? "",
    draftKind: kind,
    keyValue: draft?.key ?? (prefillDomain ? `${prefillDomain}/` : ""),
    pathValue,
    selectedDomain: selected,
    subdomainName:
      kind === "subdomain" && draft && !parents.includes(parent)
        ? draft.key
        : parent,
  };
};
