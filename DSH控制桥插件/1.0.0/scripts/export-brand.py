from pathlib import Path
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parents[1]
im=Image.open(root/'assets/logo-master.png').convert('RGBA')
assert im.getextrema()[3][0]==0
for name,size in [('icon.png',256),('logo.png',512)]:
    im.resize((size,size),Image.Resampling.LANCZOS).save(root/'lib/assets'/name)
assert (root/'lib/assets/icon.png').stat().st_size<=256*1024
files={}
for rel in ['assets/logo-master.png','lib/assets/icon.png','lib/assets/logo.png']:
    data=(root/rel).read_bytes();files[rel]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(root/'assets/branding.json').write_text(json.dumps({'generator':'OpenAI built-in imagegen; derived PNG sizes by Pillow Lanczos','date':'2026-10-12','target':'Transparent chain and terminal emblem; same Da Fei Yu character in lower-right, about half icon width.','reference':'Api-Switcher 2.2.0 assets/logo-master.png','files':files},indent=2),encoding='utf8')
print(json.dumps(files))
