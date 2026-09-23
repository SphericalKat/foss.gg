import type { FC } from "hono/jsx";

import type { AuditEntry, Link } from "../domain/link";
import type { Session } from "../domain/session";
import { splitSubdomainKey } from "../domain/subdomain-key";
import type { UserSummary } from "../domain/user";
import { shortUrl, timeAgo, withoutScheme } from "./format";
import { PageLayout } from "./layout";

export interface Notice {
  text: string;
  code?: string;
  action?: { href: string; text: string };
}

export interface LinkDraft {
  kind: string;
  key: string;
  destination: string;
}

export interface ErrorContext {
  operation: "create" | "edit";
  linkId?: number;
  field?: "address" | "destination";
}

const errorHeading = (operation?: ErrorContext["operation"]): string => {
  if (operation === "edit") {
    return "Could not save the changes.";
  }
  if (operation === "create") {
    return "Could not create the link.";
  }
  return "Could not complete the request.";
};

interface AdminPageProps {
  links: Link[];
  audit: AuditEntry[];
  users: UserSummary[];
  session: Session;
  now: number;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
  prefillDomain?: string;
  notice?: Notice;
}

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

const ownedParentLabels = (links: Link[], session: Session): string[] => [
  ...new Set(
    links
      .filter(
        (link) =>
          link.kind === "subdomain" &&
          link.owner_username === session.username &&
          !splitSubdomainKey(link.key).path
      )
      .map((link) => splitSubdomainKey(link.key).label)
  ),
];

interface NewLinkSectionProps {
  links: Link[];
  session: Session;
  draft?: LinkDraft;
  prefillDomain?: string;
  error?: string;
  errorContext?: ErrorContext;
}

interface NewLinkState {
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

const newLinkState = (
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

interface NewLinkFields {
  error?: string;
  addressError: boolean;
  destinationError: boolean;
  draftKind: Link["kind"];
  keyValue: string;
  destination: string;
  selectedDomain: string;
  pathValue?: string;
  subdomainName: string;
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
    </div>
    <p class="hint">Only subdomains you own appear here.</p>
    {ownershipMessage && (
      <p class="hint" id="new-owner-help">
        {ownershipMessage}
      </p>
    )}
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
        <span aria-hidden="true">[</span>
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
        <span aria-hidden="true">].foss.gg</span>
      </div>
      <p class="error-text" id="new-client-address-error" hidden />
    </div>
    <div class="builder-field">
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

const NewLinkSection: FC<NewLinkSectionProps> = ({
  links,
  session,
  draft,
  prefillDomain,
  error,
  errorContext,
}) => {
  const parents = ownedParentLabels(links, session);
  const state = newLinkState(parents, draft, prefillDomain);
  const createError = errorContext?.operation === "create" ? error : undefined;
  const ownershipMessage = (() => {
    if (errorContext?.operation !== "create" || !draft) {
      return;
    }
    const parent = splitSubdomainKey(draft.key).label;
    const owner = links.find(
      (link) =>
        link.kind === "subdomain" &&
        !splitSubdomainKey(link.key).path &&
        splitSubdomainKey(link.key).label === parent &&
        link.owner_username !== session.username
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

interface LinkRowProps {
  link: Link;
  session: Session;
  links: Link[];
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
}

const isParent = (link: Link): boolean =>
  link.kind === "subdomain" && !splitSubdomainKey(link.key).path;

const isChildPath = (link: Link): boolean =>
  link.kind === "subdomain" && Boolean(splitSubdomainKey(link.key).path);

const deleteFallbackMessage = (link: Link): string =>
  `This address will use ${splitSubdomainKey(link.key).label}.foss.gg's default destination.`;

const deleteConfirmation = (link: Link): string => {
  if (isParent(link) || !isChildPath(link)) {
    return "Really delete?";
  }
  return `Delete this path? ${deleteFallbackMessage(link)}`;
};

const destinationHint = (link: Link): string => {
  if (isParent(link)) {
    return "The root and paths without their own link use this destination.";
  }
  if (isChildPath(link)) {
    return "Only this path uses this destination. Paths without their own link use this subdomain's default destination.";
  }
  return "Paths match exactly.";
};

const hasChildPaths = (link: Link, links: Link[]): boolean => {
  if (!isParent(link)) {
    return false;
  }
  const { label } = splitSubdomainKey(link.key);
  return links.some(
    (candidate) =>
      candidate.kind === "subdomain" &&
      splitSubdomainKey(candidate.key).label === label &&
      Boolean(splitSubdomainKey(candidate.key).path)
  );
};

const LinkRowActions: FC<{
  link: Link;
  editable: boolean;
  hasChildren: boolean;
}> = ({ link, editable, hasChildren }) => {
  if (!editable) {
    return <span class="owner">Owned by {link.owner_username}</span>;
  }
  const parent = isParent(link);
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
          {isChildPath(link) && (
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

interface LinkEditProps {
  link: Link;
  hasChildren: boolean;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
  failedEdit: boolean;
}

const LinkEdit: FC<LinkEditProps> = ({
  link,
  hasChildren,
  error,
  errorContext,
  draft,
  failedEdit,
}) => {
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

const LinkRow: FC<LinkRowProps> = ({
  link,
  session,
  links,
  error,
  errorContext,
  draft,
}) => {
  const editable = link.owner_username === session.username;
  const children = hasChildPaths(link, links);
  const failedEdit =
    errorContext?.operation === "edit" && errorContext.linkId === link.id;
  const values = failedEdit && draft ? draft : link;
  const url = shortUrl(link.kind, link.key);
  return (
    <li
      class={isChildPath(link) ? "child-path" : undefined}
      data-default={isParent(link) ? "true" : undefined}
      data-owner={link.owner_username}
      data-search={`${url} ${values.key} ${link.destination}`.toLowerCase()}
    >
      <div class="row">
        <div class="row-main">
          <div class="row-label">
            {isParent(link) ? "Default destination" : "Path"}
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

interface LinkGroup {
  domain: string;
  links: Link[];
}

const groupLinks = (links: Link[]): LinkGroup[] => {
  const groups = new Map<string, LinkGroup>();
  for (const link of links) {
    const domain =
      link.kind === "path"
        ? "foss.gg"
        : `${splitSubdomainKey(link.key).label}.foss.gg`;
    const group = groups.get(domain);
    if (group) {
      group.links.push(link);
    } else {
      groups.set(domain, { domain, links: [link] });
    }
  }
  return [...groups.values()];
};

const groupOwner = (group: LinkGroup, username: string): string | undefined => {
  const owners = new Set(group.links.map((link) => link.owner_username));
  if (owners.size === 1 && !owners.has(username)) {
    return [...owners][0];
  }
  return undefined;
};

const groupSummary = (group: LinkGroup): string => {
  const hasDefault = group.links.some(isParent);
  const pathCount = group.links.filter((link) => !isParent(link)).length;
  const paths = `${pathCount} ${pathCount === 1 ? "path" : "paths"}`;
  if (!hasDefault) {
    return paths;
  }
  return pathCount > 0 ? `Default + ${paths}` : "Default";
};

const LinksSection: FC<{
  links: Link[];
  session: Session;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
}> = ({ links, session, error, errorContext, draft }) => (
  <section aria-labelledby="links-heading">
    <div class="section-head">
      <h2 id="links-heading">
        Links{" "}
        <span class="count" id="link-count">
          {links.length}
        </span>
      </h2>
      <div class="tabs" id="link-tools" hidden>
        <button type="button" data-scope="all" aria-pressed="true">
          All
        </button>
        <button type="button" data-scope="mine" aria-pressed="false">
          Mine
        </button>
        <label class="sr-only" htmlFor="link-search">
          Search links
        </label>
        <input
          class="field"
          id="link-search"
          type="search"
          placeholder="Search"
          autocomplete="off"
        />
      </div>
    </div>
    <ul class="list" id="links" data-me={session.username}>
      {groupLinks(links).map((group) => (
        <li class="group-item" key={group.domain}>
          <details class="domain-group" open data-domain={group.domain}>
            <summary>
              <span class="group-heading">{group.domain}</span>
              <span class="count" data-group-count>
                {groupSummary(group)}
              </span>
              {groupOwner(group, session.username) && (
                <span class="group-owner">
                  Owned by {groupOwner(group, session.username)}
                </span>
              )}
            </summary>
            <ul class="group-links">
              {group.links.filter(isParent).map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  links={links}
                  session={session}
                  error={error}
                  errorContext={errorContext}
                  draft={draft}
                />
              ))}
              {group.links.some(isParent) && group.links.some(isChildPath) && (
                <li class="paths-heading">
                  <h3>Paths on this subdomain</h3>
                </li>
              )}
              {group.links
                .filter((link) => !isParent(link))
                .map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    links={links}
                    session={session}
                    error={error}
                    errorContext={errorContext}
                    draft={draft}
                  />
                ))}
            </ul>
          </details>
        </li>
      ))}
      <li class="empty" id="no-match" hidden>
        No links match.
      </li>
      {links.length === 0 && (
        <li class="empty">No links yet. Add one above.</li>
      )}
    </ul>
  </section>
);

const ActivitySection: FC<{ audit: AuditEntry[]; now: number }> = ({
  audit,
  now,
}) => (
  <section aria-labelledby="activity-heading">
    <h2 id="activity-heading">Recent activity</h2>
    <ul class="list log">
      {audit.length ? (
        audit.map((entry) => (
          <li key={entry.id}>
            <span class="what" title={entry.destination}>
              <strong>{entry.actor_username}</strong>{" "}
              <span class={entry.action}>{entry.action}</span>{" "}
              <code>{shortUrl(entry.kind, entry.key)}</code>
            </span>
            <time datetime={entry.created_at} title={entry.created_at}>
              {timeAgo(entry.created_at, now)}
            </time>
          </li>
        ))
      ) : (
        <li class="empty">No activity yet.</li>
      )}
    </ul>
  </section>
);

const UsersSection: FC<{ users: UserSummary[]; now: number }> = ({
  users,
  now,
}) => (
  <section aria-labelledby="users-heading">
    <h2 id="users-heading">Users</h2>
    <ul class="list users">
      {users.length ? (
        users.map((user) => (
          <li key={user.username}>
            <span>{user.username}</span>
            <time datetime={user.created_at} title={user.created_at}>
              added {timeAgo(user.created_at, now)}
            </time>
          </li>
        ))
      ) : (
        <li class="empty">No users yet.</li>
      )}
    </ul>
    <form method="post" action="/admin/users" class="add-user">
      <label class="sr-only" htmlFor="new-username">
        Username
      </label>
      <input
        class="field"
        id="new-username"
        name="username"
        placeholder="Username"
        autocomplete="off"
        maxlength={32}
        required
      />
      <label class="sr-only" htmlFor="new-password">
        Password
      </label>
      <input
        class="field"
        id="new-password"
        type="password"
        name="password"
        placeholder="Password (12+ characters)"
        autocomplete="new-password"
        minlength={12}
        maxlength={256}
        required
      />
      <button type="submit" class="btn secondary">
        Add user
      </button>
    </form>
    <p class="hint">Each user can edit only their own links.</p>
  </section>
);

export const AdminPage: FC<AdminPageProps> = ({
  links,
  audit,
  users,
  session,
  now,
  error,
  errorContext,
  draft,
  prefillDomain,
  notice,
}) => (
  <PageLayout title="foss.gg links" session={session} withScript>
    <main class="admin">
      {error && (
        <div class="notice error" role="alert">
          <strong>{errorHeading(errorContext?.operation)}</strong>
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <output class="notice">
          <span class="ok" aria-hidden="true">
            ✓
          </span>
          <span>
            {notice.text} {notice.code && <code>{notice.code}</code>}
          </span>
          {notice.action && (
            <a class="link-btn" href={notice.action.href}>
              {notice.action.text}
            </a>
          )}
          <a class="link-btn" href="/admin">
            Dismiss
          </a>
        </output>
      )}
      <NewLinkSection
        links={links}
        session={session}
        draft={errorContext?.operation === "create" ? draft : undefined}
        prefillDomain={prefillDomain}
        error={error}
        errorContext={errorContext}
      />
      <LinksSection
        links={links}
        session={session}
        error={error}
        errorContext={errorContext}
        draft={draft}
      />
      <ActivitySection audit={audit} now={now} />
      {session.isAdmin && <UsersSection users={users} now={now} />}
    </main>
  </PageLayout>
);
