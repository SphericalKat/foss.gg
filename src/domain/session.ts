export interface Session {
  username: string;
  isAdmin: boolean;
}

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
