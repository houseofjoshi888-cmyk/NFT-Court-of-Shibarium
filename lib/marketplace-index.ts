import { createPublicClient, decodeEventLog, erc721Abi, erc1155Abi, fallback, http, type Address, type Hex } from "viem";
import { marketplaceAbi, type IndexedOffer } from "./marketplace-abi";
import type { MarketplaceChainId } from "./marketplace-chains";
import type { chainConfig } from "./server-marketplace-config";

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
};
export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<Array<{ results: Record<string, unknown>[] }>>;
};
export type RpcLog = { data: Hex; topics: [] | [Hex, ...Hex[]]; blockNumber: Hex; transactionHash: Hex; logIndex: Hex };
export type Listing = {
  id: string; chainId: number; nftAddress: Address; tokenId: string; seller: Address;
  price: string; transactionHash: Hex; createdBlock: number; updatedBlock: number;
  tokenType?: "ERC-721" | "ERC-1155"; quantity?: string;
};
export type Activity = {
  id: string; chainId: number; eventType: string; nftAddress: Address | null; tokenId: string | null;
  seller: Address | null; buyer: Address | null; price: string | null; marketplaceFee: string | null;
  royaltyRecipient: Address | null; royaltyAmount: string | null; transactionHash: Hex;
  blockNumber: number; logIndex: number; timestamp: number; expiresAt?: number;
  tokenType?: "ERC-1155"; quantity?: string; unitPrice?: string; remaining?: string;
};
export const itemId = (chainId: number, nft: string, token: string) => `${chainId}:${nft.toLowerCase()}:${token}`;
export const offerId = (chainId: number, nft: string, token: string, buyer: string) => `${itemId(chainId,nft,token)}:${buyer.toLowerCase()}`;
export const editionOfferId = (chainId: number, nft: string, token: string, buyer: string) => `${offerId(chainId,nft,token,buyer)}:edition`;

// Shared by stateless replay and persistent indexing so both paths settle offers identically.
export function decodeMarketplaceLogs(chainId: number, logs: RpcLog[]): Activity[] {
  const events: Activity[] = [];
  for (const log of logs) {
    let decoded;
    try { decoded = decodeEventLog({abi: marketplaceAbi, data: log.data, topics: log.topics, strict: true}); }
    catch { continue; } // Unknown future events do not prevent indexing known events.
    const base: Activity = {
      id: `${chainId}:${log.transactionHash}:${Number(BigInt(log.logIndex))}`, chainId,
      eventType: "", nftAddress: null, tokenId: null, seller: null, buyer: null, price: null,
      marketplaceFee: null, royaltyRecipient: null, royaltyAmount: null,
      transactionHash: log.transactionHash, blockNumber: Number(BigInt(log.blockNumber)),
      logIndex: Number(BigInt(log.logIndex)), timestamp: 0,
    };
    switch (decoded.eventName) {
      case "EditionOfferMade": {
        const a=decoded.args;events.push({...base,eventType:"offer",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),buyer:a.buyer,price:String(a.amount),quantity:String(a.quantity),expiresAt:Number(a.expiresAt)});break;
      }
      case "EditionOfferCanceled": {
        const a=decoded.args;events.push({...base,eventType:"offer_canceled",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),buyer:a.buyer,price:String(a.amount),quantity:String(a.quantity)});break;
      }
      case "EditionOfferAccepted": {
        const a=decoded.args;events.push({...base,eventType:"offer_accepted",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller,buyer:a.buyer,price:String(a.amount),quantity:String(a.quantity),marketplaceFee:String(a.marketplaceFee),royaltyRecipient:a.royaltyRecipient,royaltyAmount:String(a.royaltyAmount)});break;
      }
      case "EditionListed": {
        const a=decoded.args;events.push({...base,eventType:"listed",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller,price:String(a.unitPrice),unitPrice:String(a.unitPrice),quantity:String(a.quantity)});break;
      }
      case "EditionCanceled": {
        const a=decoded.args;events.push({...base,eventType:"canceled",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller});break;
      }
      case "EditionBought": {
        const a=decoded.args;events.push({...base,eventType:"sold",tokenType:"ERC-1155",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller,buyer:a.buyer,quantity:String(a.quantity),unitPrice:String(a.unitPrice),remaining:String(a.remaining),price:String(a.unitPrice*a.quantity),marketplaceFee:String(a.marketplaceFee),royaltyRecipient:a.royaltyRecipient,royaltyAmount:String(a.royaltyAmount)});break;
      }
      case "ItemListed": {
        const a=decoded.args; events.push({...base,eventType:"listed",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller,price:String(a.price)}); break;
      }
      case "ItemCanceled": {
        const a=decoded.args; events.push({...base,eventType:"canceled",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller}); break;
      }
      case "ItemBought": {
        const a=decoded.args; events.push({...base,eventType:"sold",nftAddress:a.nftAddress,tokenId:String(a.tokenId),buyer:a.buyer,price:String(a.price),marketplaceFee:String(a.marketplaceFee),royaltyRecipient:a.royaltyRecipient,royaltyAmount:String(a.royaltyAmount)}); break;
      }
      case "OfferAccepted": {
        const a=decoded.args; events.push({...base,eventType:"offer_accepted",nftAddress:a.nftAddress,tokenId:String(a.tokenId),seller:a.seller,buyer:a.buyer,price:String(a.amount),marketplaceFee:String(a.marketplaceFee),royaltyRecipient:a.royaltyRecipient,royaltyAmount:String(a.royaltyAmount)}); break;
      }
      case "OfferMade": {
        const a=decoded.args; events.push({...base,eventType:"offer",nftAddress:a.nftAddress,tokenId:String(a.tokenId),buyer:a.buyer,price:String(a.amount),expiresAt:Number(a.expiresAt)}); break;
      }
      case "OfferCanceled": {
        const a=decoded.args; events.push({...base,eventType:"offer_canceled",nftAddress:a.nftAddress,tokenId:String(a.tokenId),buyer:a.buyer,price:String(a.amount)}); break;
      }
      case "ProceedsWithdrawn": events.push({...base,eventType:"withdrawn",seller:decoded.args.seller,price:String(decoded.args.amount)}); break;
    }
  }
  return events.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
}

export function replayEvents(events: Activity[]) {
  const listings = new Map<string, Listing>();
  const offers = new Map<string, IndexedOffer>();
  for (const event of events) {
    const { chainId, nftAddress, tokenId, seller, buyer, price, transactionHash, blockNumber } = event;
    if (!nftAddress || tokenId === null) continue;
    const id=itemId(chainId,nftAddress,tokenId);
    if(event.tokenType==="ERC-1155"&&buyer&&["offer","offer_canceled","offer_accepted"].includes(event.eventType)){
      const key=editionOfferId(chainId,nftAddress,tokenId,buyer);
      if(event.eventType==="offer"&&price&&event.quantity)offers.set(key,{id:key,chainId,nftAddress,tokenId,buyer,amount:price,quantity:event.quantity,tokenType:"ERC-1155",expiresAt:event.expiresAt!,status:"active",transactionHash,blockNumber});
      else offers.delete(key);
      continue;
    }
    if(event.tokenType==="ERC-1155"&&seller){
      const editionId=`${id}:${seller.toLowerCase()}`;
      const quantity=event.eventType==="listed"?event.quantity:event.remaining;
      if(event.eventType==="canceled"||quantity==="0")listings.delete(editionId);
      else if(quantity&&event.unitPrice)listings.set(editionId,{id:editionId,chainId,nftAddress,tokenId,seller,price:event.unitPrice,quantity,tokenType:"ERC-1155",transactionHash,createdBlock:blockNumber,updatedBlock:blockNumber});
      continue;
    }
    if (event.eventType === "listed" && seller && price) listings.set(id,{id,chainId,nftAddress,tokenId,seller,price,transactionHash,createdBlock:blockNumber,updatedBlock:blockNumber});
    if (["sold","canceled","offer_accepted"].includes(event.eventType)) {
      if (!event.seller) event.seller=listings.get(id)?.seller??null;
      listings.delete(id);
    }
    if (buyer && event.eventType === "offer" && price) {
      const key=offerId(chainId,nftAddress,tokenId,buyer);
      offers.set(key,{id:key,chainId,nftAddress,tokenId,buyer,amount:price,expiresAt:event.expiresAt!,status:"active",transactionHash,blockNumber});
    }
    if (buyer && ["offer_canceled","offer_accepted"].includes(event.eventType)) offers.delete(offerId(chainId,nftAddress,tokenId,buyer));
  }
  return {listings:[...listings.values()],offers:[...offers.values()],activity:events};
}

export async function mapLimit<T,U>(items:T[],limit:number,fn:(item:T)=>Promise<U>):Promise<U[]> {
  const results:U[]=new Array(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){const i=next++;results[i]=await fn(items[i]);}
  }));
  return results;
}

export function summarizeCollections(chainId: number, listings: Listing[]) {
  const groups=new Map<string,{chainId:number;nftAddress:string;floorPrice:string;listingCount:number;latestBlock:number;sampleTokenId:string}>();
  for(const item of listings){
    const key=item.nftAddress.toLowerCase(); const group=groups.get(key);
    if(!group){groups.set(key,{chainId,nftAddress:item.nftAddress,floorPrice:item.price,listingCount:1,latestBlock:item.updatedBlock,sampleTokenId:item.tokenId});continue;}
    group.listingCount++;
    if(BigInt(item.price)<BigInt(group.floorPrice))group.floorPrice=item.price;
    if(item.updatedBlock>group.latestBlock){group.latestBlock=item.updatedBlock;group.sampleTokenId=item.tokenId;}
  }
  return [...groups.values()];
}

type Config = ReturnType<typeof chainConfig>;
export function indexClient(config:Config){
  const primary=http(config.rpcUrl,{timeout:12_000,retryCount:1});
  const transport=config.fallbackRpcUrl?fallback([primary,http(config.fallbackRpcUrl,{timeout:12_000,retryCount:1})],{shouldThrow:()=>false}):primary;
  return createPublicClient({transport});
}

async function schema(db:D1Database){
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS indexer_state (id TEXT PRIMARY KEY NOT NULL, last_block INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    // New, address-scoped tables ensure a version upgrade backfills previously skipped offer events.
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_v3_listings (scope TEXT NOT NULL,id TEXT NOT NULL,chain_id INTEGER NOT NULL,nft_address TEXT NOT NULL,token_id TEXT NOT NULL,seller TEXT NOT NULL,price TEXT NOT NULL,active INTEGER NOT NULL,transaction_hash TEXT NOT NULL,created_block INTEGER NOT NULL,updated_block INTEGER NOT NULL,PRIMARY KEY(scope,id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_v3_activity (scope TEXT NOT NULL,id TEXT NOT NULL,chain_id INTEGER NOT NULL,event_type TEXT NOT NULL,nft_address TEXT,token_id TEXT,seller TEXT,buyer TEXT,price TEXT,marketplace_fee TEXT,royalty_recipient TEXT,royalty_amount TEXT,transaction_hash TEXT NOT NULL,block_number INTEGER NOT NULL,log_index INTEGER NOT NULL,timestamp INTEGER NOT NULL,PRIMARY KEY(scope,id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_v3_offers (scope TEXT NOT NULL,id TEXT NOT NULL,chain_id INTEGER NOT NULL,nft_address TEXT NOT NULL,token_id TEXT NOT NULL,buyer TEXT NOT NULL,amount TEXT NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,transaction_hash TEXT NOT NULL,block_number INTEGER NOT NULL,PRIMARY KEY(scope,id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS marketplace_v3_listing_scope ON marketplace_v3_listings(scope,active,updated_block)"),
    db.prepare("CREATE INDEX IF NOT EXISTS marketplace_v3_activity_scope ON marketplace_v3_activity(scope,block_number,log_index)"),
    db.prepare("CREATE INDEX IF NOT EXISTS marketplace_v3_activity_item ON marketplace_v3_activity(scope,nft_address,token_id,block_number)"),
    db.prepare("CREATE INDEX IF NOT EXISTS marketplace_v3_offer_scope ON marketplace_v3_offers(scope,status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_v4_editions (scope TEXT NOT NULL,id TEXT NOT NULL,chain_id INTEGER NOT NULL,nft_address TEXT NOT NULL,token_id TEXT NOT NULL,seller TEXT NOT NULL,price TEXT NOT NULL,quantity TEXT NOT NULL,transaction_hash TEXT NOT NULL,created_block INTEGER NOT NULL,updated_block INTEGER NOT NULL,PRIMARY KEY(scope,id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_v5_edition_offers (scope TEXT NOT NULL,id TEXT NOT NULL,chain_id INTEGER NOT NULL,nft_address TEXT NOT NULL,token_id TEXT NOT NULL,buyer TEXT NOT NULL,amount TEXT NOT NULL,quantity TEXT NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,transaction_hash TEXT NOT NULL,block_number INTEGER NOT NULL,PRIMARY KEY(scope,id))"),
  ]);
}

export function eventStatements(db:D1Database,scope:string,events:Activity[]){
  const statements:D1PreparedStatement[]=[];
  for(const e of events){
    const id=e.nftAddress&&e.tokenId!==null?itemId(e.chainId,e.nftAddress,e.tokenId):null;
    if(e.tokenType==="ERC-1155"&&e.buyer&&e.nftAddress&&e.tokenId!==null&&["offer","offer_canceled","offer_accepted"].includes(e.eventType)){
      const key=editionOfferId(e.chainId,e.nftAddress,e.tokenId,e.buyer);
      if(e.eventType==="offer")statements.push(db.prepare("INSERT INTO marketplace_v5_edition_offers VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET amount=excluded.amount,quantity=excluded.quantity,expires_at=excluded.expires_at,status='active',transaction_hash=excluded.transaction_hash,block_number=excluded.block_number WHERE excluded.block_number>=marketplace_v5_edition_offers.block_number").bind(scope,key,e.chainId,e.nftAddress,e.tokenId,e.buyer,e.price,e.quantity,e.expiresAt,"active",e.transactionHash,e.blockNumber));
      else statements.push(db.prepare("UPDATE marketplace_v5_edition_offers SET status=?,transaction_hash=?,block_number=? WHERE scope=? AND id=? AND block_number<=?").bind(e.eventType==="offer_accepted"?"accepted":"canceled",e.transactionHash,e.blockNumber,scope,key,e.blockNumber));
      statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_v3_activity VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(scope,e.id,e.chainId,e.eventType,e.nftAddress,e.tokenId,e.seller,e.buyer,e.price,e.marketplaceFee,e.royaltyRecipient,e.royaltyAmount,e.transactionHash,e.blockNumber,e.logIndex,e.timestamp));
      continue;
    }
    if(e.tokenType==="ERC-1155"&&e.seller){
      const key=`${id}:${e.seller.toLowerCase()}`,quantity=e.eventType==="listed"?e.quantity:e.remaining;
      if(e.eventType==="canceled"||quantity==="0")statements.push(db.prepare("UPDATE marketplace_v4_editions SET quantity='0',updated_block=? WHERE scope=? AND id=? AND updated_block<=?").bind(e.blockNumber,scope,key,e.blockNumber));
      else if(quantity&&e.unitPrice)statements.push(db.prepare("INSERT INTO marketplace_v4_editions VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET price=excluded.price,quantity=excluded.quantity,transaction_hash=excluded.transaction_hash,updated_block=excluded.updated_block WHERE excluded.updated_block>=marketplace_v4_editions.updated_block").bind(scope,key,e.chainId,e.nftAddress,e.tokenId,e.seller,e.unitPrice,quantity,e.transactionHash,e.blockNumber,e.blockNumber));
      statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_v3_activity VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(scope,e.id,e.chainId,e.eventType,e.nftAddress,e.tokenId,e.seller,e.buyer,e.price,e.marketplaceFee,e.royaltyRecipient,e.royaltyAmount,e.transactionHash,e.blockNumber,e.logIndex,e.timestamp));
      continue;
    }
    if(e.eventType==="listed")statements.push(db.prepare("INSERT INTO marketplace_v3_listings VALUES (?,?,?,?,?,?,?,1,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET seller=excluded.seller,price=excluded.price,active=1,transaction_hash=excluded.transaction_hash,updated_block=excluded.updated_block WHERE excluded.updated_block>=marketplace_v3_listings.updated_block").bind(scope,id,e.chainId,e.nftAddress,e.tokenId,e.seller,e.price,e.transactionHash,e.blockNumber,e.blockNumber));
    // Record the previous seller before deactivating a fixed-price listing.
    statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_v3_activity VALUES (?,?,?,?,?,?,COALESCE(?,(SELECT seller FROM marketplace_v3_listings WHERE scope=? AND id=?)),?,?,?,?,?,?,?,?,?)").bind(scope,e.id,e.chainId,e.eventType,e.nftAddress,e.tokenId,e.seller,scope,id,e.buyer,e.price,e.marketplaceFee,e.royaltyRecipient,e.royaltyAmount,e.transactionHash,e.blockNumber,e.logIndex,e.timestamp));
    if(["sold","canceled","offer_accepted"].includes(e.eventType))statements.push(db.prepare("UPDATE marketplace_v3_listings SET active=0,updated_block=?,transaction_hash=? WHERE scope=? AND id=? AND updated_block<=?").bind(e.blockNumber,e.transactionHash,scope,id,e.blockNumber));
    if(e.buyer&&e.nftAddress&&e.tokenId!==null){
      const key=offerId(e.chainId,e.nftAddress,e.tokenId,e.buyer);
      if(e.eventType==="offer")statements.push(db.prepare("INSERT INTO marketplace_v3_offers VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET amount=excluded.amount,expires_at=excluded.expires_at,status='active',transaction_hash=excluded.transaction_hash,block_number=excluded.block_number WHERE excluded.block_number>=marketplace_v3_offers.block_number").bind(scope,key,e.chainId,e.nftAddress,e.tokenId,e.buyer,e.price,e.expiresAt,"active",e.transactionHash,e.blockNumber));
      if(["offer_canceled","offer_accepted"].includes(e.eventType))statements.push(db.prepare("UPDATE marketplace_v3_offers SET status=?,transaction_hash=?,block_number=? WHERE scope=? AND id=? AND block_number<=?").bind(e.eventType==="offer_accepted"?"accepted":"canceled",e.transactionHash,e.blockNumber,scope,key,e.blockNumber));
    }
  }
  return statements;
}

const CHUNK_SIZE=8_000, MAX_CHUNKS=8;
async function rangeLogs(client:ReturnType<typeof indexClient>,address:Address,start:number,end:number):Promise<{logs:RpcLog[];through:number}> {
  try {
    const logs=await client.request({method:"eth_getLogs",params:[{address,fromBlock:`0x${start.toString(16)}`,toBlock:`0x${end.toString(16)}`}]}) as RpcLog[];
    return {logs,through:end};
  } catch(error) {
    // Retry only range/result-size errors, never turn authentication or throttling
    // failures into hundreds of additional requests. No cursor advances on error.
    if(end===start||!/range|too many|response size|limit.*block|maximum.*block|query.*exceed/i.test(String(error)))throw error;
    const middle=Math.floor((start+end)/2);
    // Commit a smaller successful range and resume the remainder on the next
    // bounded iteration, rather than recursively issuing thousands of requests.
    return rangeLogs(client,address,start,middle);
  }
}
const pending=new Map<string,Promise<Awaited<ReturnType<typeof buildIndex>>>>();
export async function loadMarketplaceIndex(config:Config,db?:D1Database){
  const scope=`marketplace:v3:${config.chain.id}:${config.address.toLowerCase()}`;
  // Serialize concurrent reads in this process; database batches commit events and cursor together.
  let work=pending.get(scope);
  if(!work){work=buildIndex(config,scope,db);pending.set(scope,work);}
  try{return await work;}finally{if(pending.get(scope)===work)pending.delete(scope);}
}

async function buildIndex(config:Config,scope:string,db?:D1Database){
  const client=indexClient(config), address=config.address as Address, chainId=config.chain.id as MarketplaceChainId;
  const safeLatest=Math.max(0,Number(await client.getBlockNumber())-config.chain.confirmations);
  const deployBlock=Number(config.deployBlock);
  let start=Math.max(deployBlock,safeLatest-CHUNK_SIZE*MAX_CHUNKS+1);
  if(db){await schema(db);const state=await db.prepare("SELECT last_block AS lastBlock FROM indexer_state WHERE id=?").bind(scope).first<{lastBlock:number}>();start=Math.max(deployBlock,(state?.lastBlock??deployBlock-1)+1);}
  const fromBlock=start, events:Activity[]=[];
  let chunks=0,logsProcessed=0;
  while(start<=safeLatest&&chunks++<MAX_CHUNKS){
    const {logs,through:end}=await rangeLogs(client,address,start,Math.min(start+CHUNK_SIZE-1,safeLatest));
    const decoded=decodeMarketplaceLogs(chainId,logs as RpcLog[]);
    const times=new Map<number,number>();
    await mapLimit([...new Set(decoded.map(e=>e.blockNumber))],6,async block=>{times.set(block,Number((await client.getBlock({blockNumber:BigInt(block)})).timestamp));});
    decoded.forEach(e=>{e.timestamp=times.get(e.blockNumber)!;});
    if(db){const statements=eventStatements(db,scope,decoded);statements.push(db.prepare("INSERT INTO indexer_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET last_block=MAX(last_block,excluded.last_block),updated_at=excluded.updated_at").bind(scope,end,Date.now()));await db.batch(statements);}
    else events.push(...decoded);
    logsProcessed+=logs.length;start=end+1;
  }
  let {listings,offers,activity}=replayEvents(events);
  if(db){
    const result=await db.batch([
      db.prepare("SELECT id,chain_id AS chainId,nft_address AS nftAddress,token_id AS tokenId,seller,price,transaction_hash AS transactionHash,created_block AS createdBlock,updated_block AS updatedBlock FROM marketplace_v3_listings WHERE scope=? AND active=1").bind(scope),
      db.prepare("SELECT id,chain_id AS chainId,nft_address AS nftAddress,token_id AS tokenId,buyer,amount,expires_at AS expiresAt,status,transaction_hash AS transactionHash,block_number AS blockNumber FROM marketplace_v3_offers WHERE scope=? AND status='active'").bind(scope),
      db.prepare("SELECT id,chain_id AS chainId,event_type AS eventType,nft_address AS nftAddress,token_id AS tokenId,seller,buyer,price,marketplace_fee AS marketplaceFee,royalty_recipient AS royaltyRecipient,royalty_amount AS royaltyAmount,transaction_hash AS transactionHash,block_number AS blockNumber,log_index AS logIndex,timestamp FROM marketplace_v3_activity WHERE scope=? ORDER BY block_number DESC,log_index DESC LIMIT 100").bind(scope),
    ]);
    const editions=await db.batch([
      db.prepare("SELECT id,chain_id AS chainId,nft_address AS nftAddress,token_id AS tokenId,seller,price,quantity,'ERC-1155' AS tokenType,transaction_hash AS transactionHash,created_block AS createdBlock,updated_block AS updatedBlock FROM marketplace_v4_editions WHERE scope=? AND quantity!='0'").bind(scope),
      db.prepare("SELECT id,chain_id AS chainId,nft_address AS nftAddress,token_id AS tokenId,buyer,amount,quantity,expires_at AS expiresAt,status,'ERC-1155' AS tokenType,transaction_hash AS transactionHash,block_number AS blockNumber FROM marketplace_v5_edition_offers WHERE scope=? AND status='active'").bind(scope),
    ]);
    listings=[...result[0].results,...editions[0].results] as Listing[];offers=[...result[1].results,...editions[1].results] as IndexedOffer[];activity=result[2].results as Activity[];
  }
  let verificationFailed=false;
  const verified=await mapLimit(listings,6,async item=>{
    try{
      const args=[item.nftAddress,BigInt(item.tokenId)] as const;
      if(item.tokenType==="ERC-1155"){
        const [current,balance,approved]=await Promise.all([
          client.readContract({address,abi:marketplaceAbi,functionName:"getEditionListing",args:[...args,item.seller]}),
          client.readContract({address:item.nftAddress,abi:erc1155Abi,functionName:"balanceOf",args:[item.seller,args[1]]}),
          client.readContract({address:item.nftAddress,abi:erc1155Abi,functionName:"isApprovedForAll",args:[item.seller,address]}),
        ]);
        const quantity=current.quantity<balance?current.quantity:balance;
        return quantity>0n&&current.unitPrice>0n&&approved?{...item,quantity:String(quantity),price:String(current.unitPrice)}:null;
      }
      const [current,owner,approved,approvedForAll]=await Promise.all([
        client.readContract({address,abi:marketplaceAbi,functionName:"getListing",args}),
        client.readContract({address:item.nftAddress,abi:erc721Abi,functionName:"ownerOf",args:[args[1]]}),
        client.readContract({address:item.nftAddress,abi:erc721Abi,functionName:"getApproved",args:[args[1]]}),
        client.readContract({address:item.nftAddress,abi:erc721Abi,functionName:"isApprovedForAll",args:[item.seller,address]}),
      ]);
      return current.price>0n&&current.price===BigInt(item.price)&&current.seller.toLowerCase()===item.seller.toLowerCase()&&owner.toLowerCase()===item.seller.toLowerCase()&&(approved.toLowerCase()===address.toLowerCase()||approvedForAll)?item:null;
    }catch{verificationFailed=true;return null;}
  });
  const active=verified.filter((item):item is Listing=>item!==null).sort((a,b)=>b.updatedBlock-a.updatedBlock);
  const caughtUp=start>safeLatest&&(!!db||fromBlock===deployBlock);
  return {listings:active,collections:summarizeCollections(chainId,active),offers,activity:activity.sort((a,b)=>b.timestamp-a.timestamp||b.blockNumber-a.blockNumber||b.logIndex-a.logIndex).slice(0,100),sync:{safeLatest,syncedThrough:Math.min(start-1,safeLatest),caughtUp,logsProcessed},syncError:verificationFailed?"Some listings could not be verified and are hidden. Please retry.":!caughtUp?"Indexing is incomplete; older listings and offers may not appear yet.":null};
}
