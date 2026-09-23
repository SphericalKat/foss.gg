import type { FC } from "hono/jsx";

import type { ErrorContext, Notice } from "./types";

const errorHeading = (operation?: ErrorContext["operation"]): string => {
  if (operation === "edit") {
    return "Could not save the changes.";
  }
  if (operation === "create") {
    return "Could not create the link.";
  }
  return "Could not complete the request.";
};

export const AdminNotices: FC<{
  error?: string;
  operation?: ErrorContext["operation"];
  notice?: Notice;
}> = ({ error, operation, notice }) => (
  <>
    {error && (
      <div class="notice error" role="alert">
        <strong>{errorHeading(operation)}</strong>
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
  </>
);
