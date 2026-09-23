import type { FC } from "hono/jsx";

import type { AuditEntry } from "../../domain/link";
import { shortUrl, timeAgo } from "../format";

export const ActivitySection: FC<{ audit: AuditEntry[]; now: number }> = ({
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
