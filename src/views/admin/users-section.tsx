import type { FC } from "hono/jsx";

import type { UserSummary } from "../../domain/user";
import { timeAgo } from "../format";

export const UsersSection: FC<{ users: UserSummary[]; now: number }> = ({
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
