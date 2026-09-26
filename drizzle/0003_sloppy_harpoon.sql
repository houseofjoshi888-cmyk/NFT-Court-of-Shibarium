CREATE TABLE `xrpl_brokered_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`seller` text NOT NULL,
	`sell_offer_id` text NOT NULL,
	`sell_amount` text NOT NULL,
	`total_price` text NOT NULL,
	`buyer` text,
	`buy_offer_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `xrpl_brokered_status_updated_idx` ON `xrpl_brokered_listings` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `xrpl_brokered_seller_idx` ON `xrpl_brokered_listings` (`seller`);