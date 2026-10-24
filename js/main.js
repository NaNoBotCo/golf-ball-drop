// The page's start: the inks, then every part.
import { setLook, LOOKS } from './riso.js';
import { lang, countdown, share, dock, lightbox, qr, taps, prizes, calm } from './bits.js';
import { hero } from './hero.js';
import { luck, board } from './play.js';
import { give } from './give.js';
import { tally } from './tally.js';

const q = new URLSearchParams(location.search).get('look');
setLook(q && LOOKS[q] ? q : document.documentElement.dataset.look || 'picnic');
lang();
const run = (f) => { try { f({ calm }); } catch (e) { console.error(e); } };
const start = () => [hero, countdown, luck, board, prizes, tally, give, qr, share, dock, lightbox, taps].forEach(run);
// the fonts change the layout the canvases measure; draw once they are in
(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve()).then(start);
