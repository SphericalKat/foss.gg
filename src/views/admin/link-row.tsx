import type { FC } from "hono/jsx";

import {
  hasChildPaths,
  isSubdomainChildPath,
  isSubdomainParent,
} from "../../domain/link";
import type { Link } from "../../domain/link";
import { splitSubdomainKey } from "../../domain/subdomain-key";
import { shortUrl, withoutScheme } from "../format";
import { LinkEdit } from "./link-edit";
import type { ErrorContext, LinkDraft } from "./types";

const deleteFallbackMessage = (link: Link): string =>
  `This address will use ${splitSubdomainKey(link.key).label}.foss.gg's default destination.`;

const deleteConfirmation = (link: Link): string => {
  if (isSubdomainParent(link) || !isSubdomainChildPath(link)) {
    return "Really delete?";
  }
  return `Delete this path? ${deleteFallbackMessage(link)}`;
};

const LinkRowActions: FC<{
  link: Link;
  editable: boolean;
  hasChildren: boolean;
}> = ({ link, editable, hasChildren }) => {
  if (!editable) {
    return <span class="owner">Owned by {link.owner_username}</span>;
  }
  const parent = isSubdomainParent(link);
  const parentLabel = splitSubdomainKey(link.key).label;
  return (
    <>
      {parent && (
        <a
          class="link-btn"
          href={`/admin?domain=${encodeURIComponent(parentLabel)}#new-link`}
        >
          Add path
        </a>
      )}
      {hasChildren ? (
        <span class="hint">
          Delete this subdomain&apos;s paths before changing its address or
          deleting it.
        </span>
      ) : (
        <>
          {isSubdomainChildPath(link) && (
            <span class="hint delete-consequence">
              {deleteFallbackMessage(link)}
            </span>
          )}
          <form
            method="post"
            action={`/admin/links/${link.id}/delete`}
            class="delete-form"
            data-confirm={deleteConfirmation(link)}
          >
            <button type="submit" class="link-btn danger">
              Delete
            </button>
          </form>
        </>
      )}
    </>
  );
};

export const LinkRow: FC<{
  link: Link;
  links: Link[];
  username: string;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
}> = ({ link, username, links, error, errorContext, draft }) => {
  const editable = link.owner_username === username;
  const children = hasChildPaths(link, links);
  const failedEdit =
    errorContext?.operation === "edit" && errorContext.linkId === link.id;
  const values = failedEdit && draft ? draft : link;
  const url = shortUrl(link.kind, link.key);
  return (
    <li
      class={isSubdomainChildPath(link) ? "child-path" : undefined}
      data-default={isSubdomainParent(link) ? "true" : undefined}
      data-owner={link.owner_username}
      data-search={`${url} ${values.key} ${link.destination}`.toLowerCase()}
    >
      <div class="row">
        <div class="row-main">
          <div class="row-label">
            {isSubdomainParent(link) ? "Default destination" : "Path"}
          </div>
          <div class="short">
            <code title={url}>{url}</code>
            <button
              type="button"
              class="copy"
              data-copy={`https://${url}`}
              hidden
            >
              Copy
            </button>
          </div>
          <div class="dest">
            <a
              href={link.destination}
              target="_blank"
              rel="noopener noreferrer"
              title={link.destination}
            >
              {withoutScheme(link.destination)}
            </a>
          </div>
        </div>
        <div class="row-side">
          <LinkRowActions
            link={link}
            editable={editable}
            hasChildren={children}
          />
        </div>
      </div>
      {editable && (
        <LinkEdit
          link={link}
          hasChildren={children}
          error={error}
          errorContext={errorContext}
          draft={draft}
          failedEdit={failedEdit}
        />
      )}
    </li>
  );
};
