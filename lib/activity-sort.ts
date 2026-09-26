type Event={chainId:number;timestamp?:number;logIndex?:number;price:string|null};
export function sortActivity<T extends Event>(items:T[],order:"recent"|"price-high"|"price-low",chainId:number|"all"):T[]{
  return [...items].sort((a,b)=>{
    // Native currency amounts across networks must never be ranked against each other.
    if(order!=="recent"&&chainId!=="all"){
      const left=BigInt(a.price??"0"),right=BigInt(b.price??"0");
      if(left!==right)return (left<right?-1:1)*(order==="price-high"?-1:1);
    }
    return (b.timestamp??0)-(a.timestamp??0)||(a.chainId===b.chainId?(b.logIndex??0)-(a.logIndex??0):0);
  });
}
