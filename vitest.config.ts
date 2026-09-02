import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        bindings: {
          ADMIN_PASSWORD: "test-password",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
        d1Databases: ["DB"],
      },
      wrangler: { configPath: "./wrangler.jsonc" },
    })),
  ],
  test: { globals: true, setupFiles: ["./test/apply-migrations.ts"] },
});
