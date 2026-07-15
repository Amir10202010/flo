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
