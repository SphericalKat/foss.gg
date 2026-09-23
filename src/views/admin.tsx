import type { FC } from "hono/jsx";

import type { AuditEntry, Link } from "../domain/link";
import type { Session } from "../domain/session";
import type { UserSummary } from "../domain/user";
import { ActivitySection } from "./admin/activity-section";
import { LinksSection } from "./admin/links-section";
import { NewLinkSection } from "./admin/new-link-section";
import { AdminNotices } from "./admin/notices";
import type { ErrorContext, LinkDraft, Notice } from "./admin/types";
import { UsersSection } from "./admin/users-section";
import { PageLayout } from "./layout";

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
      <AdminNotices
        error={error}
        operation={errorContext?.operation}
        notice={notice}
      />
      <NewLinkSection
        links={links}
        username={session.username}
        draft={errorContext?.operation === "create" ? draft : undefined}
        prefillDomain={prefillDomain}
        error={error}
        errorContext={errorContext}
      />
      <LinksSection
        links={links}
        username={session.username}
        error={error}
        errorContext={errorContext}
        draft={draft}
      />
      <ActivitySection audit={audit} now={now} />
      {session.isAdmin && <UsersSection users={users} now={now} />}
    </main>
  </PageLayout>
);
