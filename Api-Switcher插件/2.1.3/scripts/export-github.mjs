import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { checkProject, root, walk } from './check-project.mjs'
checkProject()
const [destination,releaseDirectory]=process.argv.slice(2)
assert.ok(destination&&releaseDirectory,'Usage: export-github.mjs empty-destination release-directory')
const target=resolve(destination),release=resolve(releaseDirectory)
mkdirSync(target,{recursive:true});assert.equal(readdirSync(target).length,0,'Export directory must be empty')
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
const prefix=`Api-Switcher插件/${manifest.version}`
const files=[]
for(const name of walk(root)){
  const path=`${prefix}/${name}`,output=join(target,path)
  mkdirSync(dirname(output),{recursive:true});copyFileSync(join(root,name),output);files.push(path)
}
for(const name of [`${manifest.name}-${manifest.version}.tgz`,`${manifest.name}-${manifest.version}-Windows.zip`,'release-manifest.json','SHA256SUMS.txt']){
  const path=`${prefix}/dist/${name}`,output=join(target,path)
  mkdirSync(dirname(output),{recursive:true});copyFileSync(join(release,name),output);files.push(path)
}
function readmeAt(pathPrefix) {
  const text=readFileSync(join(root,'README.md'),'utf8')
  return text.replace(/(\]\(|\bsrc=")([^)"\s]+)/g,(all,start,href)=>{
    if(!href||href.startsWith('#')||/^[a-z][a-z0-9+.-]*:/i.test(href))return all
    return start+pathPrefix+'/'+href
  })
}
const index='# DSH插件\n\n源码与安装包按`Api-Switcher插件/<版本号>`保存；最高指令插件见[项目入口](最高指令插件/README.md)。发布时仅替换本项目目录，保留仓库中其他插件。\n\n'+readmeAt(prefix).replace(/^# api-switcher/,'## api-switcher')+'\n默认分支和Release仅保留各项目最新版，历史变更通过Git提交追溯。用户凭据、profile、日志及部署备份不收入仓库。\n'
const pluginIndex=readmeAt(manifest.version)+'\n版本目录是独立可构建项目，安装包在对应的dist/内；仅保留最新版，历史变更通过Git提交追溯。\n'
const workflow=`name: api-switcher checks\non:\n  push:\n    paths: ['Api-Switcher插件/**', '.github/workflows/ci.yml']\n  pull_request:\n    paths: ['Api-Switcher插件/**', '.github/workflows/ci.yml']\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  test:\n    strategy:\n      matrix:\n        os: [ubuntu-latest, windows-latest]\n        node: [20, 24]\n    runs-on: \${{ matrix.os }}\n    defaults:\n      run:\n        working-directory: '${prefix}'\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@v7\n        with:\n          node-version: \${{ matrix.node }}\n          package-manager-cache: false\n      - run: node scripts/run-tests.mjs\n      - run: node scripts/check-project.mjs\n      - run: node scripts/build-release.mjs .work/ci-dist\n      - run: node scripts/unpack-release.mjs .work/ci-dist/${manifest.name}-${manifest.version}.tgz .work/ci-unpacked\n      - run: node Verify-Package.mjs .work/ci-dist/${manifest.name}-${manifest.version}.tgz .work/ci-unpacked/package\n`
const extra={'README.md':index,'Api-Switcher插件/README.md':pluginIndex,'LICENSE':readFileSync(join(root,'LICENSE'),'utf8'),'.github/workflows/ci.yml':workflow,'.github/pull_request_template.md':'说明问题与修改后行为。\n\n验证：\n\n- 本地测试及构建结果\n- 需要时的真实DSH桌面验证\n- 真实供应商测试是否运行，以及授权/计费范围\n\n请确认不含Key、用户配置、日志或聊天记录。\n','.gitignore':'.work/\nnode_modules/\n*.log\n.env\n.env.*\n.credentials.yaml\nstate.json\nprofiles/\ndeployment-backups/\n'}
for(const [path,content] of Object.entries(extra)){mkdirSync(dirname(join(target,path)),{recursive:true});writeFileSync(join(target,path),content);files.push(path)}
const hashes=files.sort().map(path=>`${createHash('sha256').update(readFileSync(join(target,path))).digest('hex')}  ${path}`)
writeFileSync(join(target,'PUBLISH-SHA256SUMS.txt'),hashes.join('\n')+'\n')
console.log(JSON.stringify({version:manifest.version,exportedFiles:files.length+1,versionPath:prefix}))
