import type { FC } from "hono/jsx";

import { isSubdomainParent, ownedParentLabels } from "../../domain/link";
import type { Link } from "../../domain/link";
import { splitSubdomainKey } from "../../domain/subdomain-key";
import { newLinkState } from "./new-link-state";
import type { NewLinkState } from "./new-link-state";
import type { ErrorContext, LinkDraft } from "./types";

interface NewLinkFields extends NewLinkState {
  error?: string;
  addressError: boolean;
  destinationError: boolean;
  ownershipMessage?: string;
}

const AddressBuilder: FC<NewLinkFields & { parents: string[] }> = ({
  parents,
  error,
  addressError,
  destinationError,
  selectedDomain: domainSelection,
  pathValue,
  subdomainName,
  destination,
  ownershipMessage,
}) => (
  <div class="address-builder" id="address-builder">
    <div class="builder-field">
      <label htmlFor="new-domain">Domain</label>
      <select class="field" id="new-domain">
        <option value="path" selected={domainSelection === "path"}>
          foss.gg
        </option>
        {parents.map((parent) => (
          <option
            key={parent}
            value={`subdomain:${parent}`}
            selected={domainSelection === `subdomain:${parent}`}
          >
            {parent}.foss.gg
          </option>
        ))}
        <option value="create" selected={domainSelection === "create"}>
          Create a subdomain…
        </option>
      </select>
      <p class="hint">Only subdomains you own appear here.</p>
      {ownershipMessage && (
        <p class="hint" id="new-owner-help">
          {ownershipMessage}
        </p>
      )}
    </div>
    <div class="builder-field" id="path-field">
      <label htmlFor="new-path">Path</label>
      <input
        class="field mono"
        id="new-path"
        autocomplete="off"
        placeholder={domainSelection === "path" ? "/matrix" : "/tickets"}
        value={pathValue}
        aria-invalid={addressError ? "true" : undefined}
        aria-describedby={addressError ? "new-address-error" : undefined}
      />
    </div>
    <div class="builder-field subdomain-fields" id="subdomain-fields" hidden>
      <label htmlFor="new-subdomain-name">Subdomain name</label>
      <div class="address-input">
        <input
          class="field mono"
          id="new-subdomain-name"
          autocomplete="off"
          placeholder="events"
          value={subdomainName}
          aria-invalid={addressError ? "true" : undefined}
          aria-describedby={
            addressError
              ? "new-address-error new-client-address-error"
              : "new-client-address-error"
          }
        />
        <span aria-hidden="true">.foss.gg</span>
      </div>
      <p class="error-text" id="new-client-address-error" hidden />
    </div>
    <div class="builder-field builder-destination">
      <label htmlFor="new-destination" id="new-destination-label">
        {domainSelection === "create"
          ? "Default destination URL"
          : "Destination URL"}
      </label>
      <input
        class="field"
        id="new-destination"
        type="url"
        name="destination"
        autocomplete="url"
        placeholder="https://destination.example"
        value={destination}
        aria-invalid={destinationError ? "true" : undefined}
        aria-describedby={
          destinationError ? "new-destination-error" : undefined
        }
      />
    </div>
    <p class="preview" id="preview" aria-live="polite">
      Short link: <code>foss.gg/matrix</code>
    </p>
    <p class="hint" id="new-helper">
      Paths match exactly.
    </p>
    <p class="hint" id="new-reserved-help">
      On foss.gg, the root, /admin, and paths under /admin/ are reserved.
    </p>
    {error && (addressError || destinationError) && (
      <p
        class="error-text"
        id={addressError ? "new-address-error" : "new-destination-error"}
      >
        {error}
      </p>
    )}
    <div class="builder-actions">
      <button type="submit" class="btn" id="new-submit">
        {domainSelection === "create" ? "Create subdomain" : "Create link"}
      </button>
    </div>
  </div>
);

export const NewLinkSection: FC<{
  links: Link[];
  username: string;
  draft?: LinkDraft;
  prefillDomain?: string;
  error?: string;
  errorContext?: ErrorContext;
}> = ({ links, username, draft, prefillDomain, error, errorContext }) => {
  const parents = ownedParentLabels(links, username);
  const state = newLinkState(parents, draft, prefillDomain);
  const createError = errorContext?.operation === "create" ? error : undefined;
  const ownershipMessage = (() => {
    if (errorContext?.operation !== "create" || !draft) {
      return;
    }
    const parent = splitSubdomainKey(draft.key).label;
    const owner = links.find(
      (link) =>
        isSubdomainParent(link) &&
        splitSubdomainKey(link.key).label === parent &&
        link.owner_username !== username
    )?.owner_username;
    return owner
      ? `This subdomain belongs to ${owner}. Choose one you own or create another.`
      : undefined;
  })();
  const fields: NewLinkFields = {
    ...state,
    addressError:
      errorContext?.operation === "create" && errorContext.field === "address",
    destinationError:
      errorContext?.operation === "create" &&
      errorContext.field === "destination",
    error: createError,
    ownershipMessage,
  };
  return (
    <section aria-labelledby="new-link-heading" id="new-link">
      <h2 id="new-link-heading">New link</h2>
      <form
        method="post"
        action="/admin/links"
        class="new-link"
        id="new-link-form"
      >
        <input
          type="hidden"
          id="new-kind"
          name="kind"
          value={state.draftKind}
        />
        <input type="hidden" id="new-key" name="key" value={state.keyValue} />
        <AddressBuilder {...fields} parents={parents} />
      </form>
    </section>
  );
};
