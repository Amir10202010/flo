"""Post-process velnox-pitch.pptx: real poster frame + crop the pillarbox.

pptxgenjs leaves two things wrong on slide 4 that it has no API for:

1. The poster is its own grey play-button placeholder, which would sit over the
   middle of the slide until someone hits play. Replaced with poster.png — a real
   1920x1080 frame of demo.mp4 at t=1.2s, the same frame slide4.png renders.

2. demo.mp4 has 60px of black pillarbox per side. CSS crops it in index.html via
   overscan; PowerPoint's equivalent is a:srcRect on the blipFill, which is what
   its own Video Format > Crop writes. 60/1920 = 3.125% = 3125 thousandths.

srcRect crops the poster and the playback together, which is why the poster must
go in uncropped — pre-cropping it would crop it twice.

Run after build-pptx.js:  python deck/fix-video.py
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DECK = Path(__file__).resolve().parent
PPTX = DECK / "velnox-pitch.pptx"
POSTER = DECK / "poster.png"
WORK = DECK / ".pptx-work"

CROP = 3125  # 60px of 1920, in thousandths of a percent

for f in (PPTX, POSTER):
    if not f.exists():
        sys.exit(f"FAILED: missing {f}")

if WORK.exists():
    shutil.rmtree(WORK)
with zipfile.ZipFile(PPTX) as z:
    names = z.namelist()
    z.extractall(WORK)

slide4 = WORK / "ppt" / "slides" / "slide4.xml"
xml = slide4.read_text(encoding="utf-8")

# Find the video pic and, inside it, the poster's r:embed id.
pic = re.search(r"<p:pic>(?:(?!</p:pic>).)*?videoFile.*?</p:pic>", xml, re.S)
if not pic:
    sys.exit("FAILED: no <p:pic> with a videoFile on slide 4")
blip = re.search(r'<p:blipFill><a:blip r:embed="(rId\d+)"/>', pic.group(0))
if not blip:
    sys.exit("FAILED: video pic has no poster blipFill to crop")
poster_rid = blip.group(1)

# rId -> media file, via the slide's rels
rels = (WORK / "ppt" / "slides" / "_rels" / "slide4.xml.rels").read_text(encoding="utf-8")
target = re.search(rf'Id="{poster_rid}"[^>]*Target="\.\./([^"]+)"', rels)
if not target:
    sys.exit(f"FAILED: {poster_rid} is not in slide4.xml.rels")
poster_part = WORK / "ppt" / target.group(1)

old_size = poster_part.stat().st_size
shutil.copy(POSTER, poster_part)
print(f"  poster: {target.group(1)}  {old_size/1024:.0f} KB placeholder "
      f"-> {poster_part.stat().st_size/1024:.0f} KB real frame")

# Insert srcRect between blip and stretch. Order matters: CT_BlipFillProperties
# is blip, then srcRect, then the fill mode — putting it after stretch is invalid.
if "<a:srcRect" in pic.group(0):
    sys.exit("FAILED: slide 4 already has a srcRect; refusing to double-crop")

new_pic = pic.group(0).replace(
    f'<p:blipFill><a:blip r:embed="{poster_rid}"/><a:stretch>',
    f'<p:blipFill><a:blip r:embed="{poster_rid}"/>'
    f'<a:srcRect l="{CROP}" r="{CROP}"/><a:stretch>',
    1,
)
if new_pic == pic.group(0):
    sys.exit("FAILED: blipFill did not match the expected shape; not editing blind")

xml = xml[:pic.start()] + new_pic + xml[pic.end():]
slide4.write_text(xml, encoding="utf-8")
print(f'  crop:   <a:srcRect l="{CROP}" r="{CROP}"/>  (60px of 1920 per side)')

# Repack. Preserve the original entry order — [Content_Types].xml must lead.
if PPTX.exists():
    PPTX.unlink()
with zipfile.ZipFile(PPTX, "w", zipfile.ZIP_DEFLATED) as z:
    for name in names:
        z.write(WORK / name, name)

shutil.rmtree(WORK)
print(f"\nwrote {PPTX}  ({PPTX.stat().st_size/1024/1024:.1f} MB)")
