import type { FC } from "hono/jsx";

import type { AuditEntry, Link, Session, UserSummary } from "../types";
import { shortUrl, timeAgo, withoutScheme } from "./format";
import { PageLayout } from "./layout";

export interface Notice {
  text: string;
  code?: string;
}

interface AdminPageProps {
  links: Link[];
  audit: AuditEntry[];
  users: UserSummary[];
  session: Session;
  now: number;
  error?: string;
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

const LinkRow: FC<{ link: Link; session: Session }> = ({ link, session }) => {
  const editable = link.owner_username === session.username;
  const url = shortUrl(link.kind, link.key);
  const editId = `edit-${link.id}`;

  return (
    <li
      data-owner={link.owner_username}
      data-search={`${url} ${link.destination}`.toLowerCase()}
    >
      <div class="row">
        <div class="row-main">
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
          {editable ? (
            <>
              <button
                type="button"
                class="link-btn"
                data-edit
                aria-controls={editId}
                aria-expanded="false"
                hidden
              >
                Edit
              </button>
              <form
                method="post"
                action={`/admin/links/${link.id}/delete`}
                class="delete-form"
              >
                <button type="submit" class="link-btn danger">
                  Delete
                </button>
              </form>
            </>
          ) : (
            <span class="owner">{link.owner_username}</span>
          )}
        </div>
      </div>
      {editable && (
        <form
          id={editId}
          method="post"
          action={`/admin/links/${link.id}`}
          class="edit"
        >
          <label class="sr-only" htmlFor={`${editId}-kind`}>
            Type
          </label>
          <KindSelect id={`${editId}-kind`} selected={link.kind} />
          <label class="sr-only" htmlFor={`${editId}-key`}>
            Short link
          </label>
          <input
            class="field mono"
            id={`${editId}-key`}
            name="key"
            value={link.key}
            required
          />
          <label class="sr-only" htmlFor={`${editId}-destination`}>
            Destination URL
          </label>
          <input
            class="field"
            id={`${editId}-destination`}
            type="url"
            name="destination"
            value={link.destination}
            required
          />
          <div class="edit-actions">
            <button type="submit" class="btn sm">
              Save
            </button>
          </div>
        </form>
      )}
    </li>
  );
};

const NewLinkSection: FC = () => (
  <section aria-labelledby="new-link-heading">
    <h2 id="new-link-heading">New link</h2>
    <form method="post" action="/admin/links" class="new-link">
      <div class="new-row">
        <label class="sr-only" htmlFor="new-kind">
          Type
        </label>
        <KindSelect id="new-kind" />
        <label class="sr-only" htmlFor="new-key">
          Short link
        </label>
        <div class="prefixed">
          <span id="key-prefix">foss.gg/</span>
          <input
            id="new-key"
            name="key"
            autocomplete="off"
            placeholder="matrix"
            required
          />
          <span class="suffix" id="key-suffix" hidden>
            .foss.gg
          </span>
        </div>
        <label class="sr-only" htmlFor="new-destination">
          Destination URL
        </label>
        <input
          class="field"
          id="new-destination"
          type="url"
          name="destination"
          placeholder="https://destination.example"
          required
        />
        <button type="submit" class="btn">
          Add
        </button>
      </div>
      <p class="preview" id="preview" aria-live="polite">
        For a subdomain, use <code>events</code> for <code>events.foss.gg</code>{" "}
        and <code>events/tickets</code> for <code>events.foss.gg/tickets</code>.
        Other paths fall back to <code>events</code>.
      </p>
    </form>
  </section>
);

const LinksSection: FC<{ links: Link[]; session: Session }> = ({
  links,
  session,
}) => (
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
      {links.map((link) => (
        <LinkRow key={link.id} link={link} session={session} />
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
  notice,
}) => (
  <PageLayout title="foss.gg links" session={session} withScript>
    <main class="admin">
      {error && (
        <p class="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <output class="notice">
          <span class="ok" aria-hidden="true">
            ✓
          </span>
          <span>
            {notice.text} {notice.code && <code>{notice.code}</code>}
          </span>
          <a class="link-btn" href="/admin">
            Dismiss
          </a>
        </output>
      )}
      <NewLinkSection />
      <LinksSection links={links} session={session} />
      <ActivitySection audit={audit} now={now} />
      {session.isAdmin && <UsersSection users={users} now={now} />}
    </main>
  </PageLayout>
);
