"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "hoj-marketplace-favorites";

export function favoriteId(chainId:number,contract:string,tokenId:string){
  return `${chainId}:${contract.toLowerCase()}:${tokenId}`;
}

export function useFavorite(id:string){
  const[ready,setReady]=useState(false);
  const[favorite,setFavorite]=useState(false);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]") as string[];setFavorite(saved.includes(id));}catch{}
      setReady(true);
    },0);
    return()=>window.clearTimeout(timer);
  },[id]);
  function toggle(){
    setFavorite(current=>{
      const next=!current;
      try{
        const saved=new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]") as string[]);
        if(next)saved.add(id);else saved.delete(id);
        localStorage.setItem(STORAGE_KEY,JSON.stringify([...saved]));
      }catch{}
      return next;
    });
  }
  return {favorite:ready&&favorite,toggle};
}
