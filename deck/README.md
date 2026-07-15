# Velnox pitch deck

Open `index.html` in a browser. Press **F** for fullscreen.

- `→` / `Space` / click — next
- `←` — back
- `1`–`6` — jump to a slide
- `F` — fullscreen

6 slides, ~2 minutes. Audience: mentors / advisors.

## Assets

| Path | What |
|---|---|
| `shots/dashboard.png` | Real `/dashboard`, captured authenticated. Contact names blurred. |
| `../public/demo.mp4` | The real 30s product recording (referenced, not copied — no 22MB duplicate). |
| `../public/logo.png` | The real "V" mark. |
| `founder.jpg` | **Not present.** Drop a real headshot here and slide 5 picks it up automatically. |
| `export/slide*.png` | Each slide rendered at 1600×900, ready to post standalone. Re-export after any edit. |

## Adding your photo

Save a headshot as `deck/founder.jpg` (portrait, ~760×940 or larger). No code
change needed — the frame swaps from the placeholder monogram to the photo on
next load.

`public/photos/founder.jpg` is stock imagery of an unrelated person. It is not
used here, and should not be.

## Refreshing the dashboard screenshot

The numbers on slide 3's screenshot are live-at-capture-time. To re-shoot, run
the dev server, log in, and re-capture `/dashboard` at 1600×900 — remembering to
re-apply the privacy blur to contact names before saving.

Design derives from `src/app/globals.css`. If a token here drifts from the app,
the app wins.
