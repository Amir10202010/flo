/**
 * Build deck/velnox-pitch.pptx from the rendered slides.
 *
 * Each slide goes in as one full-bleed 3200x1800 image rather than as rebuilt
 * PowerPoint shapes. The design already exists and is exact; re-laying it out in
 * pptxgenjs would mean re-approximating Fraunces, the skyline SVG, the wash and
 * the annotation ring in a format that has none of them, and it would drift from
 * index.html the moment either changed. The image IS the design.
 *
 * Slide 4 additionally gets the real demo.mp4 laid over the video area of its
 * image, so the deck plays rather than freezing. Coordinates are measured, not
 * guessed — see SCENE.
 *
 * Run: node deck/build-pptx.js
 */
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const DECK = __dirname;
const OUT = path.join(DECK, 'velnox-pitch.pptx');

// The deck is authored on a fixed 1600x900 stage. LAYOUT_WIDE is 13.333x7.5in,
// the same 16:9, so one stage pixel is exactly this many inches.
const PX = 13.333 / 1600;
const STAGE_W = 13.333;
const STAGE_H = 7.5;

// .scene measured off the live page in stage coords (getBoundingClientRect,
// normalised by the stage's fit scale). Its aspect is 1.6666; the video cropped
// to 1800x1080 is 1.6667. They agree, so the crop in fix-video.py does not
// distort.
//
// Measure only once document.getAnimations() is empty. Read during the slide
// change and you catch the .slide's translateY(14px) AND the .r child's
// revealUp translateY(14px) still unwinding — y comes back 28px low, and the
// video lands 28px below the frame drawn into the background image, showing as
// a dark seam along the top of the demo. That is a real bug this file shipped
// once; a pixel diff of the PowerPoint render against the HTML one caught it.
const SCENE = { x: 230, y: 112.39, w: 1140, h: 684.02 };

// Speaker notes are Russian: the slides are English but the pitch is delivered
// in Russian. Condensed from deck/SPEECH.md — edit that, then mirror here.
// Mirrors the accuracy-checked deck/SPEECH.md — only what the product does.
// Cues, not a transcript. Six slides; slide 3 now carries two product shots
// (dashboard + knowledge graph), so the graph is pointed at there, not on a
// slide of its own.
const NOTES = {
  1: "Вы теряете клиентов, и я решил эту проблему. // «Показываю» — переход.",
  2: "У всех почта забита десятками ненужных писем, важное теряется, клиент ждёт "
   + "несколько дней и уходит. Сверху 26 писем ни о чём, внизу красным — клиент, "
   + "ждёт 12 дней. → «Он внизу не потому, что неважный — а потому что написал "
   + "раньше.» У меня таких 127. // Медленнее на ключевой фразе.",
  3: "Не идея и не макет — работает, им пользуются. За 2 недели: 500+ посещений, "
   + "112 пользователей, первая оплата, без рекламы. На экране — настоящий "
   + "продукт: дашборд, а за ним граф знаний, который Velnox строит из переписки. "
   + "// Оба скриншота реальные. НЕ говори «собирает из Meet/Zoom» — этого нет.",
  4: "AI уже проанализировал почту, показывает кто ждёт ответа. Агенту можно "
   + "спросить: что было за сегодня / какие сделки под риском / кому давно не "
   + "отвечал — или сразу написать черновики всем, кто ждёт. Отвечает мгновенно, "
   + "по всей переписке. // 5 фраз по смене подписи, между ними молчать.",
  5: "Мне 16, учусь в НИШ Астана. Призёр респ. олимпиады II степени. И два факта "
   + "не из резюме: 100 аниме за месяц, от нуля до Легенды в Dota 2. → «Звучит "
   + "несерьёзно, но это одно и то же качество — я не бросаю на середине.» "
   + "// Возраст назови с гордостью.",
  6: "Не верьте мне на слово. Возьмите телефон, отсканируйте QR, подключите свою "
   + "почту. Поможет — порекомендуйте пилотным клиентам. // Сказать и ЗАМОЛЧАТЬ.",
};

const pres = new pptxgen();
// MUST precede addSlide: pptxgenjs writes past-the-edge coordinates rather than
// clamping them, so a stale 10x5.625 canvas would silently drop every image.
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Amirkhan Sagyndyk';
pres.company = 'Velnox';
pres.title = 'Velnox — pitch';

for (let n = 1; n <= 6; n++) {
  const img = path.join(DECK, 'export2x', `slide${n}.png`);
  if (!fs.existsSync(img)) throw new Error(`missing render: ${img}`);

  const slide = pres.addSlide();
  slide.background = { color: 'F6F8FE' }; // --bg-base, in case anything shows through
  slide.addImage({ path: img, x: 0, y: 0, w: STAGE_W, h: STAGE_H });

  if (n === 4) {
    // The real recording, over the still of itself. If PowerPoint can't play it
    // the image underneath is still the right frame, so this degrades to the
    // static slide rather than to a hole.
    slide.addMedia({
      type: 'video',
      path: path.join(DECK, '..', 'public', 'demo.mp4'),
      x: SCENE.x * PX,
      y: SCENE.y * PX,
      w: SCENE.w * PX,
      h: SCENE.h * PX,
    });
  }

  slide.addNotes(NOTES[n]);
}

pres.writeFile({ fileName: OUT }).then(() => {
  const kb = fs.statSync(OUT).size / 1024;
  console.log(`wrote ${OUT}`);
  console.log(`  6 slides, ${STAGE_W}x${STAGE_H}in, ${(kb / 1024).toFixed(1)} MB`);
  console.log(`  video box: ${(SCENE.x * PX).toFixed(3)}, ${(SCENE.y * PX).toFixed(3)} ` +
              `${(SCENE.w * PX).toFixed(3)} x ${(SCENE.h * PX).toFixed(3)} in`);
  console.log(`  NEXT: python deck/fix-video.py — the poster is still pptxgenjs's grey`);
  console.log(`        placeholder and the 60px pillarbox is still uncropped.`);
});
