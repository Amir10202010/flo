# Velnox pitch deck

6 slides, ~2 minutes. Audience: mentors / advisors.

## Presenting

Open `index.html` in any browser and press **F**. That's the whole setup — there
is nothing to build, upload or convert.

| Key | |
|---|---|
| `F` | fullscreen — press this first |
| `→` / `Space` / click | next |
| `←` | back |
| `1`–`6` | jump to a slide |

The stage is a fixed 1600×900 scaled to fit, so the deck is identical on a
laptop, a 4K monitor and a 1024×768 projector. Nothing reflows.

**It works with no internet.** Fonts are embedded, the QR is inlined, the video
is a local file. Wifi at the venue is irrelevant.

**Don't move `index.html` on its own.** It reads `founder.jpg`, `shots/` and
`../public/` relative to itself. Move the repo, or the whole `deck/` folder plus
the two files it borrows from `public/`.

## If a venue demands a file: velnox-pitch.pptx

```bash
node deck/build-pptx.js && python deck/fix-video.py
```

24MB, 13.333×7.5in, six slides. Gitignored — it is a build output, and the video
inside it is `public/demo.mp4` a second time.

Each slide goes in as one full-bleed 3200×1800 render (240 DPI), not as rebuilt
PowerPoint shapes: the design already exists and is exact, and re-approximating
Fraunces, the skyline, the wash and the annotation ring in a format that has none
of them would only drift from `index.html`. Slide 4 additionally carries the real
`demo.mp4` over the video area of its own still, so it plays rather than freezes;
if PowerPoint can't play it, the still underneath is already the right frame.

`fix-video.py` exists because pptxgenjs has no API for the two things slide 4
needs: a real poster (its default is a grey play-button placeholder that would
sit over the middle of the slide) and `a:srcRect`, PowerPoint's own video crop,
to take off the 60px pillarbox. The poster must go in **uncropped** — srcRect
crops poster and playback together.

Verified by rendering the .pptx through the real PowerPoint (COM) and diffing
against the HTML: mean difference 3.14/255 per pixel, and the QR still decodes to
`https://usevelnox.com` out of the PowerPoint render.

The browser version is still the better one — it has the motion, the pulse and
the fill animations. Use the .pptx only when someone insists on a file.

## Assets

| Path | What |
|---|---|
| `founder.jpg` | Real photo of the founder. The frame is 400×533 — exactly its 3:4 — so it is shown uncropped. A replacement of a different aspect needs `.portrait`'s two numbers changed to match it. |
| `shots/landing.png` | Slide 3. The real `usevelnox.com`, shot from production at 2× (1440×900 viewport). A public page, so nothing is redacted. |
| `shots/dashboard.png` | Unused since slide 3 moved to the landing page. Kept for reference; contact names are blurred. |
| `qr.svg` | Source of the slide 6 QR. Inlined into `index.html`, so this file is a record, not a dependency. |
| `../public/demo.mp4` | Slide 4. The real 30s recording (referenced, not copied — no 22MB duplicate). |
| `../public/logo.png` | The real "V" mark. |
| `export/slide*.png` | Each slide at 1600×900, ready to post standalone. Re-export after any edit. |
| `inline-fonts.py` | Rebuilds the embedded fonts. Idempotent — safe to re-run. |

## Things that will bite you

**The QR is real.** It decodes to `https://usevelnox.com`. If that domain moves,
regenerate — `npx qrcode -t svg -e H -w 8 -o deck/qr.svg "<url>"` — and re-inline
the module path into slide 6. Don't hand-edit the path.

**Slide 3's ring is pinned to measured coordinates.** The hero CTA sits at left
44.16% / top 46.28% / w 11.67% / h 5.44% of the 1440×900 viewport `landing.png`
was shot at. Re-shoot the landing page and those move — re-measure, don't nudge
by eye.

**Slide 4's video crop is already at its maximum.** `demo.mp4` carries 60px of
black pillarbox per side, which the 106.67% overscan removes. The teal band down
the left is Screen Studio's wallpaper, not pillarbox: present at t=3s, gone at
t=5s, because the capture zooms. Cropping further eats real UI. It goes away
only by re-exporting the recording without background padding.

**`public/photos/founder.jpg` is stock imagery of an unrelated person.** It is
not used here and should not be.

Design derives from `src/app/globals.css`. If a token here drifts from the app,
the app wins.
