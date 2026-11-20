/* Hint card art: the mystery bird, revealed part by part during a run.
 * Plumage per reference (Psarocolius angustifrons, Andean form): olive-brown body, olive head,
 * russet back/rump, yellow outer tail with brown central feathers, pale yellowish bill,
 * yellowish forehead, dark eye. */
(function () {
  const OG = (window.OG = window.OG || {});
  const C = { body: '#5b4b25', belly: '#665628', head: '#6f6330', wing: '#47361e', back: '#93461c', rump: '#a8521d',
    tail: '#f2c12e', tailC: '#5e4a24', bill: '#ecdf9c', forehead: '#e2c64b', eye: '#2b1a0e', legs: '#3a2c22' };
  const P = {
    bill: 'M52,36 C40,42 20,52 4,60 C20,62 36,64 48,66 C44,56 46,44 52,36 Z',
    tail: 'M146,84 C170,98 196,116 214,136 C206,142 198,144 190,142 C176,124 156,108 138,96 Z',
    tailC: 'M144,90 C166,104 186,120 202,139',
    body: 'M50,70 C52,50 76,40 100,42 C126,44 148,58 154,78 C158,94 140,106 114,108 C86,110 60,102 52,88 Z',
    belly: 'M52,82 C58,100 82,108 110,108 C92,99 72,90 58,72 Z',
    back: 'M92,44 C118,40 146,54 156,80 C152,86 148,88 144,90 C134,68 116,56 90,54 Z',
    rump: 'M126,60 C140,66 152,76 157,84 C152,88 148,90 143,92 C138,82 132,74 122,68 Z',
    wing: 'M80,58 C102,50 130,58 146,80 C140,92 118,98 96,92 C84,84 78,70 80,58 Z',
    wingLines: 'M96,66 C112,64 126,72 136,84 M92,76 C108,76 120,82 128,90',
    forehead: 'M44,40 C50,33 60,31 68,35 C62,39 54,42 47,46 Z',
    legs: 'M98,104 L94,126 M112,104 L114,124',
    branch: 'M-4,130 C60,122 150,128 224,117',
  };
  const st = ' stroke="rgba(25,15,5,.35)" stroke-width="1.3" stroke-linejoin="round"';
  // Hidden parts are drawn as a faint dashed outline so the card doesn't look empty.
  const ghost = (d) => `<path d="${d}" fill="none" stroke="rgba(23,48,31,.18)" stroke-width="1.5" stroke-dasharray="4 4"/>`;

  /** stage 0 = nothing, 1 tail, 2 + bill/forehead, 3 + back/rump, 4 + head/eye, 5 full bird */
  OG.hintSVG = function (stage) {
    const show = (s) => stage >= s;
    const out = [];
    if (show(5)) out.push(`<path d="${P.branch}" stroke="#7a5532" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M168,121 C176,108 190,104 198,108 C192,118 180,122 168,121 Z" fill="#4f9a55"/>`);
    // tail
    out.push(show(1) ? `<g${st}><path d="${P.tail}" fill="${C.tail}"/></g><path d="${P.tailC}" stroke="${C.tailC}" stroke-width="8" fill="none" stroke-linecap="round"/>` : ghost(P.tail));
    // body
    if (show(5)) {
      out.push(`<path d="${P.legs}" stroke="${C.legs}" stroke-width="4" stroke-linecap="round" fill="none"/>`);
      out.push(`<g${st}><path d="${P.body}" fill="${C.body}"/><path d="${P.belly}" fill="${C.belly}"/></g>`);
    } else out.push(ghost(P.body));
    if (show(3)) out.push(`<g${st}><path d="${P.back}" fill="${C.back}"/><path d="${P.rump}" fill="${C.rump}"/></g>`);
    if (show(5)) out.push(`<g${st}><path d="${P.wing}" fill="${C.wing}"/></g><path d="${P.wingLines}" stroke="rgba(0,0,0,.28)" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    // head
    if (show(4)) out.push(`<circle cx="60" cy="54" r="20" fill="${C.head}"${st}/><circle cx="56" cy="48" r="3.6" fill="${C.eye}"/><circle cx="57.2" cy="46.8" r="1.2" fill="#fff"/>`);
    else out.push(`<circle cx="60" cy="54" r="20" fill="none" stroke="rgba(23,48,31,.18)" stroke-width="1.5" stroke-dasharray="4 4"/>`);
    // bill
    out.push(show(2) ? `<path d="${P.forehead}" fill="${C.forehead}"/><g${st}><path d="${P.bill}" fill="${C.bill}"/></g>` : ghost(P.bill));
    return `<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
  };
})();
