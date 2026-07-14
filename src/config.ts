import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

type APIConfig = {
  fileserverHits: number;
  platform: string;
};

type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

type Config = {
  api: APIConfig;
  db: DBConfig;
};

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/migrations",
};

export const config: Config = {
  api: {
    fileserverHits: 0,
    platform: process.env.PLATFORM!,
  },
  db: {
    url: process.env.DB_URL!,
    migrationConfig,
  },
};
