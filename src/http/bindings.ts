import type { Session } from "../domain/session";

export interface AppBindings {
  Bindings: Env;
  Variables: { session: Session | null };
}
