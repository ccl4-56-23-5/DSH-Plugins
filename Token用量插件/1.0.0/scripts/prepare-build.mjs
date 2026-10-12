import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=resolve(root,'lib');
if (dirname(target)!==root || !root.endsWith('1.0.0')) throw new Error('Unexpected build output path');
// Only generated output of this package, never the user profile.
rmSync(target,{recursive:true,force:true});
