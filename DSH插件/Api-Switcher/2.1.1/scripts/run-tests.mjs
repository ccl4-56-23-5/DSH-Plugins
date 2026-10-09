import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const files=readdirSync(join(root,'test')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>join(root,'test',name))
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'})
if(result.error)throw result.error
process.exitCode=result.status??1
