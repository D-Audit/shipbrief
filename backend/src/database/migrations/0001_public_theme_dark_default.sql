ALTER TABLE "workspaces" ALTER COLUMN "public_theme" SET DEFAULT 'dark';--> statement-breakpoint
UPDATE "workspaces" SET "public_theme" = 'dark' WHERE "public_theme" = 'light';
