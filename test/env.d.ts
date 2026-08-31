declare namespace Cloudflare {
  interface Env {
    ADMIN_PASSWORD: string;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
