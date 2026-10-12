import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../lib/assets/',import.meta.url),{recursive:true});
for(const name of ['icon.png','logo.png'])copyFileSync(new URL('../assets/'+name,import.meta.url),new URL('../lib/assets/'+name,import.meta.url));
