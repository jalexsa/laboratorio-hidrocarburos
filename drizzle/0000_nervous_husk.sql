CREATE TABLE `molecule_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`name` text NOT NULL,
	`formula` text NOT NULL,
	`family` text NOT NULL,
	`molecule_json` text NOT NULL,
	`view_mode` text DEFAULT 'condensed' NOT NULL,
	`fingerprint` text NOT NULL,
	`atom_count` integer DEFAULT 0 NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `molecule_history_owner_updated_idx` ON `molecule_history` (`owner_key`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `molecule_history_owner_version_idx` ON `molecule_history` (`owner_key`,`is_draft`,`fingerprint`);