import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['scripts/prepare-build.mjs'],['node_modules/typescript/bin/tsc','-p','tsconfig.build.json'],['node_modules/tsdown/dist/run.mjs'],['scripts/export-brand.mjs'],['node_modules/vitest/vitest.mjs','run']]) {
  const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
