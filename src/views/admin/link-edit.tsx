import type { FC } from "hono/jsx";

import { isSubdomainChildPath, isSubdomainParent } from "../../domain/link";
import type { Link } from "../../domain/link";
import { shortUrl } from "../format";
import type { ErrorContext, LinkDraft } from "./types";

const KindSelect: FC<{ id: string; selected?: Link["kind"] }> = ({
  id,
  selected = "path",
}) => (
  <select class="field" id={id} name="kind">
    <option value="path" selected={selected === "path"}>
      Path
    </option>
    <option value="subdomain" selected={selected === "subdomain"}>
      Subdomain
    </option>
  </select>
);

const destinationHint = (link: Link): string => {
  if (isSubdomainParent(link)) {
    return "The root and paths without their own link use this destination.";
  }
  if (isSubdomainChildPath(link)) {
    return "Only this path uses this destination. Paths without their own link use this subdomain's default destination.";
  }
  return "Paths match exactly.";
};

export const LinkEdit: FC<{
  link: Link;
  hasChildren: boolean;
  failedEdit: boolean;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
}> = ({ link, hasChildren, error, errorContext, draft, failedEdit }) => {
  const values = failedEdit && draft ? draft : link;
  const valueKind = values.kind === "subdomain" ? "subdomain" : "path";
  const valueUrl = shortUrl(valueKind, values.key);
  const editId = `edit-${link.id}`;
  const addressError = failedEdit && errorContext?.field === "address";
  const destinationError = failedEdit && errorContext?.field === "destination";
  return (
    <details class="edit-disclosure" id={editId} open={failedEdit}>
      <summary>Edit link</summary>
      <form method="post" action={`/admin/links/${link.id}`} class="edit">
        <p class="edit-address">
          <span>Full address</span> <code data-address-preview>{valueUrl}</code>
        </p>
        <div class="edit-field edit-destination">
          <label htmlFor={`${editId}-destination`}>Destination URL</label>
          <input
            class="field"
            id={`${editId}-destination`}
            type="url"
            name="destination"
            value={values.destination}
            required
            aria-invalid={destinationError ? "true" : undefined}
            aria-describedby={
              destinationError ? `${editId}-destination-error` : undefined
            }
          />
          {destinationError && error && (
            <p class="error-text" id={`${editId}-destination-error`}>
              {error}
            </p>
          )}
          <p class="hint" data-destination-hint>
            {destinationHint(link)}
          </p>
        </div>
        {hasChildren ? (
          <>
            <input type="hidden" name="kind" value={link.kind} />
            <input type="hidden" name="key" value={link.key} />
            <p class="readonly-address">
              This short address is read-only while this subdomain has paths.
            </p>
            {addressError && error && (
              <p class="error-text" id={`${editId}-address-error`}>
                {error}
              </p>
            )}
          </>
        ) : (
          <details class="address-disclosure" open={failedEdit}>
            <summary>Change short address</summary>
            <div class="edit-address-fields">
              <div class="edit-field">
                <label htmlFor={`${editId}-kind`}>Address type</label>
                <KindSelect id={`${editId}-kind`} selected={valueKind} />
              </div>
              <div class="edit-field">
                <label htmlFor={`${editId}-key`}>Address</label>
                <input
                  class="field mono"
                  id={`${editId}-key`}
                  name="key"
                  value={values.key}
                  placeholder="/matrix or events"
                  required
                  aria-invalid={addressError ? "true" : undefined}
                  aria-describedby={
                    addressError ? `${editId}-address-error` : undefined
                  }
                />
              </div>
              <p class="hint">
                Path example: /matrix. Subdomain example: events. Subdomain path
                example: events/tickets.
              </p>
              {addressError && error && (
                <p class="error-text" id={`${editId}-address-error`}>
                  {error}
                </p>
              )}
            </div>
          </details>
        )}
        <div class="edit-actions">
          <button type="submit" class="btn sm">
            Save changes
          </button>
        </div>
      </form>
    </details>
  );
};
