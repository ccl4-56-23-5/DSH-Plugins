import {readFileSync,writeFileSync,readdirSync,mkdirSync,statSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pkg=JSON.parse(readFileSync(join(root,'package.json'))),hash=b=>createHash('sha256').update(b).digest('hex');
const theme=readFileSync(join(root,'src/theme.css'),'utf8');
writeFileSync(join(root,'lib/client.js'),readFileSync(join(root,'src/client.js'),'utf8').replace("/*__CENTER_CSS__*/''",JSON.stringify(theme+'\n'+readFileSync(join(root,'src/center.css'),'utf8'))).replace('// __STAR_MAP_CLIENT__',readFileSync(join(root,'src/star-map-client.js'),'utf8')));
const runtime=readFileSync(join(root,'src/star-map-runtime.js'),'utf8').replace('/*__GEOMETRY__*/',readFileSync(join(root,'src/star-map-geometry.js'),'utf8'));
writeFileSync(join(root,'lib/assets/star-map.html'),readFileSync(join(root,'src/star-map.html'),'utf8').replace('/*__SHARED_THEME__*/',theme).replace('__STAR_MAP_SCRIPTS__',runtime));
const walk=(dir,prefix='')=>readdirSync(dir).sort().flatMap(n=>statSync(join(dir,n)).isDirectory()?walk(join(dir,n),prefix+n+'/'):[prefix+n]);
const names=['package.json',...pkg.files.flatMap(n=>statSync(join(root,n)).isDirectory()?walk(join(root,n),n+'/'):[n])].sort(),chunks=[],fileHashes={};
for(const n of names){
  const data=readFileSync(join(root,n)),header=Buffer.alloc(512),name='package/'+n;
  if(Buffer.byteLength(name)>=100)throw new Error('Tar path too long');
  header.write(name);
  const oct=(at,len,v)=>header.write(v.toString(8).padStart(len-1,'0')+'\0',at,len,'ascii');
  oct(100,8,0o644);oct(108,8,0);oct(116,8,0);oct(124,12,data.length);oct(136,12,1792368000);
  header.fill(32,148,156);header[156]=48;header.write('ustar\0',257);header.write('00',263);
  header.write(header.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8);
  chunks.push(header,data,Buffer.alloc((512-data.length%512)%512));fileHashes[n]=hash(data);
}
chunks.push(Buffer.alloc(1024));
const archive=gzipSync(Buffer.concat(chunks),{level:9}),filename=pkg.name+'-'+pkg.version+'.tgz';
writeFileSync(join(root,filename),archive);
writeFileSync(join(root,'release-manifest.json'),JSON.stringify({name:pkg.name,version:pkg.version,runtimeDependencies:0,files:{[filename]:{bytes:archive.length,sha256:hash(archive)}},packageFileSHA256:fileHashes},null,2)+'\n');
writeFileSync(join(root,'SHA256SUMS.txt'),hash(archive)+'  '+filename+'\n');
// Small dependency-free ZIP writer; files are stored, CRC-32 and UTF-8 names are explicit.
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const locals=[],centrals=[];let offset=0;
for(const name of [filename,'Install-DSH.ps1','release-manifest.json','SHA256SUMS.txt','README.md']){
  const body=readFileSync(join(root,name)),n=Buffer.from(name),local=Buffer.alloc(30),central=Buffer.alloc(46),crc=crc32(body);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(n.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,n,body);centrals.push(central,n);offset+=local.length+n.length+body.length;
}
const dir=Buffer.concat(centrals),end=Buffer.alloc(22),count=centrals.length/2;
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
const zipName=pkg.name+'-'+pkg.version+'-Windows.zip',zip=Buffer.concat([...locals,dir,end]);
writeFileSync(join(root,zipName),zip);
writeFileSync(join(root,'SHA256SUMS.txt'),hash(archive)+'  '+filename+'\n'+hash(zip)+'  '+zipName+'\n');
console.log(JSON.stringify({filename,bytes:archive.length,sha256:hash(archive),zipName,zipBytes:zip.length}));
