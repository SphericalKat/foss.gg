export interface Session {
  username: string;
  isAdmin: boolean;
}

export type LinkKind = "path" | "subdomain";

export interface Link {
  id: number;
  kind: LinkKind;
  key: string;
  destination: string;
  owner_username: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor_username: string;
  action: "created" | "updated" | "deleted";
  kind: LinkKind;
  key: string;
  destination: string;
  created_at: string;
}

export interface UserSummary {
  username: string;
  created_at: string;
}

export interface LinkInput {
  kind: LinkKind;
  key: string;
  destination: string;
}
