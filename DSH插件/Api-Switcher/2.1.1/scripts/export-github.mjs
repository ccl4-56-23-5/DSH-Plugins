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
const prefix=`DSH插件/Api-Switcher/${manifest.version}`
const files=[]
for(const name of walk(root)){
  const path=`${prefix}/${name}`,output=join(target,path)
  mkdirSync(dirname(output),{recursive:true});copyFileSync(join(root,name),output);files.push(path)
}
for(const name of [`${manifest.name}-${manifest.version}.tgz`,`${manifest.name}-${manifest.version}-Windows.zip`,'release-manifest.json','SHA256SUMS.txt']){
  const path=`${prefix}/dist/${name}`,output=join(target,path)
  mkdirSync(dirname(output),{recursive:true});copyFileSync(join(release,name),output);files.push(path)
}
const index=`# DSH插件\n\n本仓库按插件及语义化版本保存完整源码、文档与发行文件。\n\n| 插件 | 当前版本 | 下载 |\n| --- | --- | --- |\n| [api-switcher](DSH插件/Api-Switcher/${manifest.version}/README.md) | ${manifest.version} | [Windows安装包](DSH插件/Api-Switcher/${manifest.version}/dist/${manifest.name}-${manifest.version}-Windows.zip) |\n\n目录：\`DSH插件/Api-Switcher/<版本号>\`。每个版本均是独立可构建项目，安装包位于该版本的\`dist/\`。用户凭据、profile配置、日志及部署备份不收入仓库。\n\n[许可](LICENSE) · [安全说明](DSH插件/Api-Switcher/${manifest.version}/SECURITY.md) · [贡献指南](DSH插件/Api-Switcher/${manifest.version}/CONTRIBUTING.md)\n`
const pluginIndex=`# api-switcher\n\nDSH供应商与模型管理插件，支持供应商分组、模型启用、搜索、API易预配置与自动网站图标。\n\n最新版本：[${manifest.version}](${manifest.version}/README.md)。\n\n- [Windows安装包](${manifest.version}/dist/${manifest.name}-${manifest.version}-Windows.zip)\n- [完整文档](${manifest.version}/docs/USER_GUIDE.md)\n- [更新记录](${manifest.version}/CHANGELOG.md)\n- [校验清单](${manifest.version}/dist/SHA256SUMS.txt)\n\n内部包名为\`dsh-api-switcher\`，升级保留已有配置。后续发行创建新的版本目录。\n`
const workflow=`name: api-switcher checks\non:\n  push:\n    paths: ['DSH插件/Api-Switcher/**', '.github/workflows/ci.yml']\n  pull_request:\n    paths: ['DSH插件/Api-Switcher/**', '.github/workflows/ci.yml']\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  test:\n    strategy:\n      matrix:\n        os: [ubuntu-latest, windows-latest]\n        node: [20, 24]\n    runs-on: \${{ matrix.os }}\n    defaults:\n      run:\n        working-directory: '${prefix}'\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@v7\n        with:\n          node-version: \${{ matrix.node }}\n          package-manager-cache: false\n      - run: node scripts/run-tests.mjs\n      - run: node scripts/check-project.mjs\n      - run: node scripts/build-release.mjs .work/ci-dist\n      - run: node scripts/unpack-release.mjs .work/ci-dist/${manifest.name}-${manifest.version}.tgz .work/ci-unpacked\n      - run: node Verify-Package.mjs .work/ci-dist/${manifest.name}-${manifest.version}.tgz .work/ci-unpacked/package\n`
const extra={'README.md':index,'DSH插件/Api-Switcher/README.md':pluginIndex,'LICENSE':readFileSync(join(root,'LICENSE'),'utf8'),'.github/workflows/ci.yml':workflow,'.github/pull_request_template.md':'说明问题与修改后行为。\n\n验证：\n\n- 本地测试及构建结果\n- 需要时的真实DSH桌面验证\n- 真实供应商测试是否运行，以及授权/计费范围\n\n请确认不含Key、用户配置、日志或聊天记录。\n','.gitignore':'.work/\nnode_modules/\n*.log\n.env\n.env.*\n.credentials.yaml\nstate.json\nprofiles/\ndeployment-backups/\n'}
for(const [path,content] of Object.entries(extra)){mkdirSync(dirname(join(target,path)),{recursive:true});writeFileSync(join(target,path),content);files.push(path)}
const hashes=files.sort().map(path=>`${createHash('sha256').update(readFileSync(join(target,path))).digest('hex')}  ${path}`)
writeFileSync(join(target,'PUBLISH-SHA256SUMS.txt'),hashes.join('\n')+'\n')
console.log(JSON.stringify({version:manifest.version,exportedFiles:files.length+1,versionPath:prefix}))
