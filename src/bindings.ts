import type { Session } from "./types";

export interface AppBindings {
  Bindings: Env;
  Variables: { session: Session | null };
}
