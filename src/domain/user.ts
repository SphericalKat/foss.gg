export const isUsername = (value: string): boolean =>
  value.length <= 32 && /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/u.test(value);

export interface UserSummary {
  username: string;
  created_at: string;
}
