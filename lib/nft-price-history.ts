import type { Activity } from "./marketplace-index";

export type PriceHistoryPoint = {
  id: string;
  eventType: "listed" | "sold" | "offer_accepted";
  price: string;
  timestamp: number;
  blockNumber: number;
  logIndex: number;
  transactionHash: string;
  quantity: string | null;
};

export function toPriceHistoryPoints(events: Activity[]): PriceHistoryPoint[] {
  return events.flatMap(event => {
    if (!(["listed", "sold", "offer_accepted"] as string[]).includes(event.eventType) || !event.price) return [];
    try {
      const total = BigInt(event.price);
      if (total <= 0n) return [];
      return [{
        id: event.id,
        eventType: event.eventType as PriceHistoryPoint["eventType"],
        price: total.toString(),
        timestamp: event.timestamp,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        transactionHash: event.transactionHash,
        quantity: event.quantity ?? null,
      }];
    } catch { return []; }
  }).sort((a,b) => a.blockNumber-b.blockNumber || a.logIndex-b.logIndex);
}
