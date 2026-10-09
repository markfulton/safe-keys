# Assets

Everything here renders from the pages in `src/` in headless Chrome, with Montserrat for the display line, Inter for text and JetBrains Mono for the eyebrow, the club's three faces. Give each render its own `--user-data-dir`; a running Chrome otherwise swallows the headless one and writes nothing.

| File | What it is | Render |
|---|---|---|
| `logo-light.png`, `logo-dark.png` | The README wordmark, 1680 by 400 on a transparent ground, shown at `width="480"` in a `picture` tag so each GitHub theme gets its own. The mark is the placeholder itself: a tile carrying a dollar sign, which is what a pasted key turns into. | `src/logo.html` (add `#dark`), `--window-size=840,200`, scale 2 |
| `btn-guide.png`, `btn-join.png`, `btn-sessions.png`, `btn-club.png` | The header buttons, one image each so each keeps its own link and `utm_content`. Cream primary, signal blue second, navy for the two that follow. 60 tall at display size, as wide as their own text. | `src/header-buttons.html#<name>`, `--window-size=420,60`, scale 3, then trim the transparent edges |
| `how-it-works.png` | The one picture of the idea: a key goes in, a name comes out everywhere a person or model looks, and the real value reaches only the tool. 2400 by 1080, shown at `width="900"`. | `src/how-it-works.html`, `--window-size=1200,540`, scale 2 |
| `hero.jpg` | 1600 by 900. A brass key dissolving into blue glyphs that form a tag. Generated with Nano Banana 2.1 at 2K, 16:9, no text in the image. | Prompt at the foot of this file |
| `social-preview.png` | 1280 by 640, the hero centre-cropped to 2:1. Upload by hand under the repository's Social preview setting; GitHub does not read it from the tree. | PIL crop of the 2K hero |

Rebuild a page:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=840,200 --virtual-time-budget=9000 --default-background-color=00000000 --user-data-dir="$env:TEMP\sk-chrome" --screenshot="D:\safe-keys\assets\logo-light.png" "file:///D:/safe-keys/assets/src/logo.html"
```

The hero prompt: "Cinematic editorial still life for a developer security tool, no text anywhere. A single old brass key is dissolving mid-air into a stream of small glowing signal-blue monospace glyphs that form a soft blue tag shape, drifting toward a dark navy laptop screen that shows only a faint blue placeholder bar. Deep navy background #0D161B, warm cream highlights #F1E8CB, signal blue #0B7FC7 accents, soft rim light, shallow depth of field, premium product photography feel, clean, minimal, lots of negative space on the right third. Absolutely no letters, words, numbers or UI text."
