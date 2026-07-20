CREATE TABLE `indexer_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`nft_address` text NOT NULL,
	`token_id` text NOT NULL,
	`seller` text NOT NULL,
	`price` text NOT NULL,
	`active` integer NOT NULL,
	`transaction_hash` text NOT NULL,
	`created_block` integer NOT NULL,
	`updated_block` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_active_block_idx` ON `listings` (`active`,`updated_block`);--> statement-breakpoint
CREATE INDEX `listings_seller_idx` ON `listings` (`seller`);--> statement-breakpoint
CREATE TABLE `marketplace_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`nft_address` text,
	`token_id` text,
	`seller` text,
	`buyer` text,
	`price` text,
	`transaction_hash` text NOT NULL,
	`block_number` integer NOT NULL,
	`log_index` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_block_idx` ON `marketplace_activity` (`block_number`,`log_index`);