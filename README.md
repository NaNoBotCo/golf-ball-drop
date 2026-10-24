# Golf Ball Drop 2027

Rotary Club of Chiang Mai International · Sat 30 Jan 2027 · Horizon Village & Resort, Doi Saket.

https://nanobotco.github.io/golf-ball-drop/ · also https://motdang.net/sites/golf-ball-drop/

A riso-printed page in Thai and English. Every picture is printed in code the way a risograph prints: one layer per ink, each a little off register, tone as a halftone screen.

| File | What |
|---|---|
| `index.html`, `gbd.css` | the page; the inks are CSS variables set by `js/riso.js` |
| `js/riso.js` | the riso kit: ink sets (`LOOKS`), `screen()` halftones, `crayon()` lines, `print()` |
| `js/scene.js` | the 2026 balloon, the lawn with its chalk X, the tape, the crowd, golf balls, the burner's flame |
| `js/hero.js` | the hero: tap the balloon to fire it, drag it, pull the cord for 300 balls, tap the sky or the people |
| `js/play.js` | the lucky number machine and the drop simulator |
| `js/give.js` | Fill the balloon: the amount fills it; the club's bank transfer and the email to the treasurer |
| `js/bits.js` | language, countdown, share, QR, ticket, prize coins |
| `js/qr.js` | QR encoder (from ClubWheel) |
| `js/dingbats.js` | the doodle dingbats this page uses, built by `node tools/dingbats.mjs` from `../doodle-dingbats` |

Checks: `node tools/check.mjs --w 390` (plays every toy, prints page errors), `node dev/compare.mjs` (every ink set side by side at phone size), `node tools/shot.mjs <path> --out <png>`.

The way to give is the club's own, as published at https://www.cmirotary.org/donate.
