import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkRepository, plugins } from './check-repository.mjs';
console.log(JSON.stringify(checkRepository()));
for(const plugin of plugins()) {
  const work=join(plugin.path,'.work/ci-unpacked'); mkdirSync(work,{recursive:true});
  const commands=plugin.pkg.name==='dsh-api-switcher' ? [
    ['scripts/run-tests.mjs'],['scripts/check-project.mjs'],
    ['scripts/unpack-release.mjs',join(plugin.releaseDirectory,`${plugin.pkg.name}-${plugin.version}.tgz`),work],
    ['Verify-Package.mjs',join(plugin.releaseDirectory,`${plugin.pkg.name}-${plugin.version}.tgz`),join(work,'package')]
  ] : [['--test','test/host.test.mjs']];
  for(const args of commands) {
    const result=spawnSync(process.execPath,args,{cwd:plugin.path,stdio:'inherit'});
    if(result.status!==0)process.exit(result.status||1);
  }
}
console.log('All repository, package and plugin checks passed.');
