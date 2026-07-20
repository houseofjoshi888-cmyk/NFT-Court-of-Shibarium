import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const indexerState = sqliteTable("indexer_state", {
  id: text("id").primaryKey(),
  lastBlock: integer("last_block").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  nftAddress: text("nft_address").notNull(),
  tokenId: text("token_id").notNull(),
  seller: text("seller").notNull(),
  price: text("price").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  transactionHash: text("transaction_hash").notNull(),
  createdBlock: integer("created_block").notNull(),
  updatedBlock: integer("updated_block").notNull(),
}, (table) => [
  index("listings_active_block_idx").on(table.active, table.updatedBlock),
  index("listings_seller_idx").on(table.seller),
]);

export const marketplaceActivity = sqliteTable("marketplace_activity", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  nftAddress: text("nft_address"),
  tokenId: text("token_id"),
  seller: text("seller"),
  buyer: text("buyer"),
  price: text("price"),
  marketplaceFee: text("marketplace_fee"),
  royaltyRecipient: text("royalty_recipient"),
  royaltyAmount: text("royalty_amount"),
  transactionHash: text("transaction_hash").notNull(),
  blockNumber: integer("block_number").notNull(),
  logIndex: integer("log_index").notNull(),
}, (table) => [index("activity_block_idx").on(table.blockNumber, table.logIndex)]);
