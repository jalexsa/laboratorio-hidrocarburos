CREATE TABLE `saved_molecules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`name` text NOT NULL,
	`formula` text NOT NULL,
	`family` text NOT NULL,
	`molecule_json` text NOT NULL,
	`view_mode` text DEFAULT 'condensed' NOT NULL,
	`fingerprint` text NOT NULL,
	`atom_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_molecules_owner_updated_idx` ON `saved_molecules` (`owner_key`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_molecules_owner_fingerprint_idx` ON `saved_molecules` (`owner_key`,`fingerprint`);