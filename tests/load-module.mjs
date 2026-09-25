import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
export async function loadModule(source){
  await mkdir("work/test-modules",{recursive:true});
  const outfile=path.resolve("work/test-modules",`${process.pid}_${source}`.replaceAll("/","_").replace(/\.tsx?$/, ".mjs"));
  await build({entryPoints:[source],outfile,bundle:true,platform:"node",format:"esm",packages:"external",logLevel:"silent"});
  return import(pathToFileURL(outfile).href);
}
