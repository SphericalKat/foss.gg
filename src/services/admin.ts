import type { AuditEntry, Link } from "../domain/link";
import type { UserSummary } from "../domain/user";
import { listAuditEntries, listLinks } from "../repositories/links";
import { listUsers } from "../repositories/users";

export const loadAdminPage = async (
  db: D1Database,
  isAdmin: boolean
): Promise<{ links: Link[]; audit: AuditEntry[]; users: UserSummary[] }> => {
  const [links, audit, users] = await Promise.all([
    listLinks(db),
    listAuditEntries(db),
    isAdmin ? listUsers(db) : Promise.resolve<UserSummary[]>([]),
  ]);
  return { audit, links, users };
};
