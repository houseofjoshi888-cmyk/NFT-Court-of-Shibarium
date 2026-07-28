CREATE TABLE `multichain_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`chain_id` integer NOT NULL,
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
CREATE INDEX `multichain_listings_chain_active_idx` ON `multichain_listings` (`chain_id`,`active`,`updated_block`);--> statement-breakpoint
CREATE INDEX `multichain_listings_chain_seller_idx` ON `multichain_listings` (`chain_id`,`seller`);--> statement-breakpoint
CREATE TABLE `multichain_marketplace_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`chain_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`nft_address` text,
	`token_id` text,
	`seller` text,
	`buyer` text,
	`price` text,
	`marketplace_fee` text,
	`royalty_recipient` text,
	`royalty_amount` text,
	`transaction_hash` text NOT NULL,
	`block_number` integer NOT NULL,
	`log_index` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `multichain_activity_chain_block_idx` ON `multichain_marketplace_activity` (`chain_id`,`block_number`,`log_index`);