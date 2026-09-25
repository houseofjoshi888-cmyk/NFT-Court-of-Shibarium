import type { Hash, PublicClient } from "viem";

export async function confirmedReceipt(client:Pick<PublicClient,"waitForTransactionReceipt">,hash:Hash,onHash:(hash:Hash)=>void=()=>{}){
  let replaced=false;
  const receipt=await client.waitForTransactionReceipt({hash,timeout:180_000,onReplaced:replacement=>{
    onHash(replacement.transaction.hash);
    if(replacement.reason!=="repriced")replaced=true;
  }});
  if(replaced)throw new Error("The transaction was canceled or replaced with a different action. No success has been recorded for this action.");
  if(receipt.status!=="success")throw new Error("The transaction failed on chain. Your action was not completed.");
  return receipt;
}
