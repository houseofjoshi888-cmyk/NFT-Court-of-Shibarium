const baseUrl=(process.env.MARKETPLACE_URL??"https://nftmarketplace.thehouseofjoshi.com").replace(/\/$/,"");
const owner=process.env.OWNER_ADDRESS;
const chains=[
  [25,"Cronos"],
  [109,"Shibarium"],
  [137,"Polygon"],
  [8453,"Base"],
  [7777777,"Zora"],
];

if(owner&&!/^0x[a-fA-F0-9]{40}$/.test(owner))throw new Error("OWNER_ADDRESS must be an EVM wallet address.");

async function json(path){
  const response=await fetch(new URL(path,baseUrl),{signal:AbortSignal.timeout(20_000),cache:"no-store"});
  const body=await response.json();
  return {response,body};
}

let failed=false;
await Promise.all(chains.map(async ([chainId,name])=>{
  try{
    const {response,body}=await json(`/api/indexer?chainId=${chainId}`);
    const healthy=response.ok&&body.configured===true&&body.sync?.caughtUp===true&&!body.syncError;
    console.log(`${healthy?"OK":"FAIL"} ${name} listings=${body.listings?.length??"?"} synced=${body.sync?.syncedThrough??"?"}/${body.sync?.safeLatest??"?"}${body.syncError?` reason=${body.syncError}`:""}`);
    if(!healthy)failed=true;
    if(owner){
      const holdings=await json(`/api/wallet-nfts?owner=${owner}&chainId=${chainId}`);
      const complete=holdings.response.ok&&holdings.body.complete===true;
      console.log(`${complete?"OK":"FAIL"} ${name} wallet NFTs=${holdings.body.nfts?.length??"?"}${complete?"":` reason=${holdings.body.error??holdings.body.warnings?.join("; ")??"incomplete"}`}`);
      if(!complete)failed=true;
    }
  }catch(error){failed=true;console.log(`FAIL ${name} ${error instanceof Error?error.message:"request failed"}`);}
}));
if(failed)process.exitCode=1;
