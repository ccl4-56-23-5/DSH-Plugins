from pathlib import Path
import zipfile,hashlib
root=Path(__file__).resolve().parents[1]
names=['dsh-control-bridge-1.0.0.tgz','Install-DSH.ps1','release-manifest.json','README.md','VALIDATION.md']
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
text=''.join(f'{hashfile(root/n)}  {n}\n' for n in names)
target=root/'dsh-control-bridge-1.0.0-Windows.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for n in names:z.write(root/n,n)
    z.writestr('SHA256SUMS.txt',text)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    for n in names:assert hashlib.sha256(z.read(n)).hexdigest()==hashfile(root/n)
(root/'SHA256SUMS.txt').write_text(text+f'{hashfile(target)}  {target.name}\n',encoding='utf8')
print(target,hashfile(target))
