ALTER TABLE "workspaces" ADD COLUMN "changelog_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "changelog_subscribe" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "changelog_show_author" boolean DEFAULT false NOT NULL;