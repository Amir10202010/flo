"""Inline the deck's two webfonts so it renders correctly with no network.

The deck pulled Inter and Fraunces from fonts.googleapis.com. On a venue with no
wifi that silently falls back to system-ui/Georgia — the hero headline stops
being Fraunces and the whole deck stops looking like Velnox. Both faces are
variable, so one woff2 each covers every weight the deck uses.
"""
import re, sys, base64, pathlib, urllib.request

DECK = str(pathlib.Path(__file__).resolve().parent / "index.html")
CSS_URL = ("https://fonts.googleapis.com/css2?"
           "family=Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1"
           "&family=Inter:wght@400;500;600;700&display=swap")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def fetch(url, ua=UA):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": ua})).read()


css = fetch(CSS_URL).decode("utf-8")
faces = re.findall(r"/\*\s*([a-z0-9\[\]-]+)\s*\*/\s*@font-face\s*\{([^}]+)\}", css)

# Google emits one @font-face per weight, but for a variable family every one of
# them points at the SAME woff2 (Inter: four blocks, 400/500/600/700, one file).
# Taking the first block verbatim would declare Inter as weight 400 only and the
# browser would synthesise 500-700 off it — faux bold, wrong shapes. Emitting all
# four would embed the same 47 KB four times. So: collapse per family, one rule,
# and widen font-weight to the range the file actually carries.
WEIGHT_RANGE = {"Inter": "100 900", "Fraunces": "100 900"}

rules = []
for family in ("Inter", "Fraunces"):
    urls, weights, urange = set(), [], None
    for subset, body in faces:
        if subset != "latin":
            continue
        if re.search(r"font-family: '([^']+)'", body).group(1) != family:
            continue
        urls.add(re.search(r"url\((https[^)]+)\)", body).group(1))
        weights.append(re.search(r"font-weight: ([^;]+);", body).group(1))
        urange = re.search(r"unicode-range: ([^;]+);", body).group(1)
    if not urls:
        sys.exit(f"FAILED: no latin face found for {family}")
    if len(urls) != 1:
        sys.exit(f"FAILED: {family} latin spans {len(urls)} files; "
                 f"it is not a single variable file and needs separate rules")

    url = urls.pop()
    blob = fetch(url)
    b64 = base64.b64encode(blob).decode()
    print(f"  {family:9} {len(blob)/1024:6.1f} KB woff2  "
          f"(google declared weights: {', '.join(weights)} -> {WEIGHT_RANGE[family]})")
    rules.append(
        f"@font-face {{\n"
        f"  font-family: '{family}';\n"
        f"  font-style: normal;\n"
        f"  font-weight: {WEIGHT_RANGE[family]};\n"
        f"  font-display: block;\n"
        f"  src: url(data:font/woff2;base64,{b64}) format('woff2');\n"
        f"  unicode-range: {urange};\n"
        f"}}"
    )

html = open(DECK, encoding="utf-8").read()

# Re-runnable: on a first run there are <link>s to strip, on later runs there is
# a previous inline block to replace. Exactly one of the two must match, or the
# deck is in a shape this script does not understand and should not rewrite.
LINKS = (r'\n<link rel="preconnect" href="https://fonts\.googleapis\.com" />'
         r'\n<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin />'
         r'\n<link href="https://fonts\.googleapis\.com/css2\?[^"]+" rel="stylesheet" />')
PREV = r"/\* ── Fonts, embedded ─.*?\n@font-face \{.*?\n\}\n\n(?=/\* ═)"

had_links = re.search(LINKS, html) is not None
had_prev = re.search(PREV, html, flags=re.S) is not None
if had_links == had_prev:
    sys.exit(f"FAILED: expected exactly one of <link> block / previous inline "
             f"(found links={had_links}, previous={had_prev}). Not rewriting.")

if had_links:
    html = re.sub(LINKS, "", html, count=1)
    print("  removed the Google Fonts <link> block")
else:
    html = re.sub(PREV, "", html, count=1, flags=re.S)
    print("  removed the previous inline font block")

banner = (
    "/* ── Fonts, embedded ──────────────────────────────────────────────────────\n"
    "   Inter and Fraunces as base64 woff2 rather than a fonts.googleapis.com\n"
    "   link. A deck that needs wifi to render its own typeface is a deck that\n"
    "   fails in exactly the room it was built for: no network meant a silent\n"
    "   fallback to system-ui/Georgia, and the Fraunces hero was the first thing\n"
    "   to go. Both faces are variable, so one file each covers every weight and\n"
    "   the opsz/SOFT/WONK axes .hero-serif pins.\n"
    "   font-display: block, not swap — a projector should never show one frame\n"
    "   of fallback type. Regenerate with `python deck/inline-fonts.py`. */\n"
)
marker = "<style>\n"
if marker not in html:
    sys.exit("FAILED: no <style> block found")
html = html.replace(marker, marker + banner + "\n".join(rules) + "\n\n", 1)

open(DECK, "w", encoding="utf-8").write(html)
print(f"\nwrote {DECK}")
print(f"  size {len(html)/1024:.0f} KB, {len(rules)} faces inlined, 0 network requests")
