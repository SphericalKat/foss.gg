import type { FC } from "hono/jsx";
import type { Session } from "../session";
import { AdminLayout } from "./layout";

export type Link = {
  id: number;
  kind: "path" | "subdomain";
  key: string;
  destination: string;
  owner_username: string;
  created_at: string;
  updated_at: string;
};

export type AuditEntry = {
  id: number;
  actor_username: string;
  action: "created" | "updated" | "deleted";
  kind: Link["kind"];
  key: string;
  destination: string;
  created_at: string;
};

export type UserSummary = {
  username: string;
  created_at: string;
};

type AdminPageProps = {
  links: Link[];
  audit: AuditEntry[];
  users: UserSummary[];
  session: Session;
  error?: string;
};

export const AdminPage: FC<AdminPageProps> = ({ links, audit, users, session, error }) => (
  <AdminLayout title="foss.gg links">
    <header>
      <div>
        <h1>foss.gg links</h1>
        <small>Logged in as {session.username}</small>
      </div>
      <form method="post" action="/admin/logout">
        <button>Log out</button>
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
        <input name="key" placeholder="/example or example" required />
        <input type="url" name="destination" placeholder="https://example.com" required />
        <button>Add link</button>
      </form>
    </section>
    <section>
      <h2>Saved links</h2>
      <ul>
        {links.length ? (
          links.map((link) => <LinkRow key={link.id} link={link} session={session} />)
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
          <button>Add user</button>
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
              <strong>{entry.actor_username}</strong> {entry.action} <code>{entry.key}</code> as{" "}
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

const LinkRow: FC<{ link: Link; session: Session }> = ({ link, session }) => (
  <li>
    {link.owner_username === session.username ? (
      <>
        <form method="post" action={`/admin/links/${link.id}`}>
          <select name="kind">
            <option value="path" selected={link.kind === "path"}>
              Path
            </option>
            <option value="subdomain" selected={link.kind === "subdomain"}>
              Subdomain
            </option>
          </select>
          <input name="key" value={link.key} required />
          <input type="url" name="destination" value={link.destination} required />
          <button>Save</button>
        </form>
        <form method="post" action={`/admin/links/${link.id}/delete`}>
          <button class="danger">Delete</button>
        </form>
      </>
    ) : (
      <>
        <span>{link.kind}</span>
        <code>{link.key}</code>
        <a href={link.destination}>{link.destination}</a>
      </>
    )}
    <small>Set by {link.owner_username}</small>
  </li>
);
