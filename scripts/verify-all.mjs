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
  ] : plugin.pkg.name==='dsh-usage-statistics-panel' ? [['scripts/verify-release.mjs']] : plugin.pkg.name==='dsh-repo-manager' ? [['--test','test/manager.test.mjs','test/cache.test.mjs','test/health.test.mjs','test/operations.test.mjs']] : plugin.pkg.name==='dsh-control-bridge' ? [['--test','test/control.test.mjs']] : plugin.pkg.name==='dsh-storydeck' ? [['--test','test/worldbook.test.mjs','test/rikka.test.mjs'],['--check','lib/client.js'],['--check','lib/worldbook.js'],['--check','lib/rikka.js']] : [['--test','test/host.test.mjs']];
  if(plugin.pkg.name==='dsh-storydeck')commands[0].push('test/workspace.test.mjs');
  for(const args of commands) {
    const result=spawnSync(process.execPath,args,{cwd:plugin.path,stdio:'inherit'});
    if(result.status!==0)process.exit(result.status||1);
  }
}
console.log('All repository, package and plugin checks passed.');
