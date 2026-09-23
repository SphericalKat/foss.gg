import type { FC } from "hono/jsx";

import type { AuditEntry, Link, Session, UserSummary } from "../types";
import { AdminLayout } from "./layout";

interface AdminPageProps {
  links: Link[];
  audit: AuditEntry[];
  users: UserSummary[];
  session: Session;
  error?: string;
}

const LinkRow: FC<{ link: Link; session: Session }> = ({ link, session }) => {
  const editable = link.owner_username === session.username;

  return (
    <li class="link-row">
      <form method="post" action={`/admin/links/${link.id}`} class="link-edit">
        <select name="kind" disabled={!editable}>
          <option value="path" selected={link.kind === "path"}>
            Path
          </option>
          <option value="subdomain" selected={link.kind === "subdomain"}>
            Subdomain
          </option>
        </select>
        <input name="key" value={link.key} required disabled={!editable} />
        <input
          type="url"
          name="destination"
          value={link.destination}
          required
          disabled={!editable}
        />
        <button type="submit" disabled={!editable}>
          Save
        </button>
      </form>
      {editable && (
        <form
          method="post"
          action={`/admin/links/${link.id}/delete`}
          class="link-delete"
        >
          <button type="submit" class="danger">
            Delete
          </button>
        </form>
      )}
      <small>Set by {link.owner_username}</small>
    </li>
  );
};

export const AdminPage: FC<AdminPageProps> = ({
  links,
  audit,
  users,
  session,
  error,
}) => (
  <AdminLayout title="foss.gg links">
    <header>
      <div>
        <h1>foss.gg links</h1>
        <small>Logged in as {session.username}</small>
      </div>
      <form method="post" action="/admin/logout">
        <button type="submit">Log out</button>
      </form>
    </header>
    {error && <p class="error">{error}</p>}
    <section>
      <h2>New link</h2>
      <form method="post" action="/admin/links">
        <select name="kind">
          <option value="path">Path</option>
          <option value="subdomain">Subdomain</option>
        </select>
        <input
          name="key"
          placeholder="/example or example or example/tickets"
          required
        />
        <input
          type="url"
          name="destination"
          placeholder="https://example.com"
          required
        />
        <button type="submit">Add link</button>
      </form>
      <small>
        For subdomain, use <code>example</code> for <code>example.foss.gg</code>{" "}
        and <code>example/tickets</code> for{" "}
        <code>example.foss.gg/tickets</code> — unknown paths fall back to{" "}
        <code>example</code>.
      </small>
    </section>
    <section>
      <h2>Saved links</h2>
      <ul>
        {links.length ? (
          links.map((link) => (
            <LinkRow key={link.id} link={link} session={session} />
          ))
        ) : (
          <li>No links yet</li>
        )}
      </ul>
    </section>
    {session.isAdmin && (
      <section>
        <h2>Users</h2>
        <form method="post" action="/admin/users">
          <input
            name="username"
            placeholder="username"
            autocomplete="off"
            maxlength={32}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="password"
            autocomplete="new-password"
            minlength={12}
            maxlength={256}
            required
          />
          <button type="submit">Add user</button>
        </form>
        <ul>
          {users.length ? (
            users.map((user) => (
              <li key={user.username}>
                <strong>{user.username}</strong>
                <small>Added {user.created_at}</small>
              </li>
            ))
          ) : (
            <li>No users yet</li>
          )}
        </ul>
      </section>
    )}
    <section>
      <h2>Recent activity</h2>
      <ul class="activity">
        {audit.length ? (
          audit.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.actor_username}</strong> {entry.action}{" "}
              <code>{entry.key}</code> as{" "}
              <a href={entry.destination}>{entry.destination}</a>{" "}
              <time datetime={entry.created_at}>{entry.created_at}</time>
            </li>
          ))
        ) : (
          <li>No activity yet</li>
        )}
      </ul>
    </section>
  </AdminLayout>
);
