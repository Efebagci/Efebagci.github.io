// ============================================================
// Rank emblems — one SVG per tier, drawn in flat facets of three
// tones of the tier's color (light from the top-left). Each tier's
// emblem is more elaborate than the one below it, so climbing feels
// like it looks like something.
// ============================================================

const TIER_TONES = [
  // [light, base, dark] per tier: Wood, Copper, Iron, Silver, Gold, Diamond
  ["#C9B58F", "#9C8867", "#65543A"],
  ["#EBA67A", "#C97A4A", "#86492A"],
  ["#CDD2D8", "#9AA1AB", "#5A616C"],
  ["#F2F5F8", "#CBD3DC", "#8793A2"],
  ["#FFE39A", "#FFC53D", "#B98410"],
  ["#D6F8FA", "#8FE3E8", "#3E9CA6"],
];
const INK = "#15162B";

let emblemCounter = 0; // keeps clipPath ids unique when several emblems share a page

function pts(list) {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

// Points of a regular polygon centered on (cx, cy); rotation in degrees, 0 = first point straight up.
function regular(cx, cy, r, n, rotation = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rotation + (360 / n) * i - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

// Picks light/base/dark for a facet whose outward direction is `angle`
// (degrees, 0 = up), with light coming from the top-left.
function shade(tones, angle) {
  const d = Math.cos(((angle + 45) * Math.PI) / 180);
  return d > 0.35 ? tones[0] : d < -0.35 ? tones[2] : tones[1];
}

// Splits a convex polygon into center-to-edge triangles, each shaded by its direction.
function facets(cx, cy, points, tones) {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const mx = (p[0] + q[0]) / 2 - cx;
    const my = (p[1] + q[1]) / 2 - cy;
    const angle = (Math.atan2(mx, -my) * 180) / Math.PI;
    return `<polygon points="${pts([[cx, cy], p, q])}" fill="${shade(tones, angle)}"/>`;
  }).join("");
}

const SHIELD = "M60 10 L102 24 L98 66 C94 90 78 104 60 112 C42 104 26 90 22 66 L18 24 Z";
const SHIELD_INNER = "M60 20 L93 31 L90 65 C87 84 75 96 60 102 C45 96 33 84 30 65 L27 31 Z";

const EMBLEMS = [
  // Wood — carved shield with grain
  (t, id) => `
    <path d="${SHIELD}" fill="${t[2]}"/>
    <clipPath id="${id}"><path d="${SHIELD_INNER}"/></clipPath>
    <g clip-path="url(#${id})">
      <rect x="0" y="0" width="60" height="120" fill="${t[0]}"/>
      <rect x="60" y="0" width="60" height="120" fill="${t[1]}"/>
      <path d="M20 42 C40 36 56 48 100 40 M20 78 C44 70 70 86 100 76 M20 96 C40 92 66 100 100 94" stroke="${t[2]}" stroke-width="2.5" fill="none" opacity="0.7"/>
    </g>
    <path d="M60 20 L60 102" stroke="${t[2]}" stroke-width="1.5" opacity="0.5"/>`,

  // Copper — riveted, faceted hexagon
  (t) => {
    const outer = regular(60, 60, 54, 6);
    const inner = regular(60, 60, 44, 6);
    const rivets = regular(60, 60, 49, 6)
      .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${t[0]}" stroke="${t[2]}" stroke-width="1"/>`)
      .join("");
    return `<polygon points="${pts(outer)}" fill="${t[2]}"/>${facets(60, 60, inner, t)}${rivets}`;
  },

  // Iron — shield with shoulder spikes and a chevron band
  (t, id) => `
    <polygon points="${pts([[18, 24], [4, 14], [12, 40]])}" fill="${t[2]}"/>
    <polygon points="${pts([[102, 24], [116, 14], [108, 40]])}" fill="${t[2]}"/>
    <path d="${SHIELD}" fill="${t[2]}"/>
    <clipPath id="${id}"><path d="${SHIELD_INNER}"/></clipPath>
    <g clip-path="url(#${id})">
      <rect x="0" y="0" width="60" height="120" fill="${t[0]}"/>
      <rect x="60" y="0" width="60" height="120" fill="${t[1]}"/>
      <polygon points="${pts([[20, 70], [60, 94], [100, 70], [100, 82], [60, 106], [20, 82]])}" fill="${t[2]}"/>
    </g>
    <path d="M60 20 L60 102" stroke="${t[0]}" stroke-width="2" opacity="0.8"/>
    <polygon points="${pts([[60, 12], [66, 20], [60, 26], [54, 20]])}" fill="${t[0]}"/>`,

  // Silver — faceted eight-pointed star with a ring
  (t) => {
    const tips = regular(60, 60, 56, 8);
    const valleys = regular(60, 60, 30, 8, 22.5);
    const points = tips.map((tip, i) => {
      const left = valleys[(i + 7) % 8];
      const right = valleys[i];
      const angle = i * 45;
      return `<polygon points="${pts([[60, 60], left, tip])}" fill="${shade(t, angle - 20)}"/>` +
        `<polygon points="${pts([[60, 60], tip, right])}" fill="${shade(t, angle + 20)}"/>`;
    }).join("");
    return `<polygon points="${pts(tips.flatMap((tip, i) => [tip, valleys[i]]))}" fill="${t[2]}" stroke="${t[2]}" stroke-width="4" stroke-linejoin="round"/>` +
      points + `<circle cx="60" cy="60" r="27" fill="none" stroke="${t[2]}" stroke-width="3"/>`;
  },

  // Gold — crowned crest with layered wings
  (t, id) => {
    const wing = (side) => {
      const s = side === "left" ? -1 : 1;
      const x = (dx) => 60 + s * dx;
      return [
        `<polygon points="${pts([[x(30), 44], [x(58), 30], [x(52), 48]])}" fill="${t[2]}"/>`,
        `<polygon points="${pts([[x(30), 58], [x(58), 52], [x(50), 66]])}" fill="${t[1]}"/>`,
        `<polygon points="${pts([[x(30), 72], [x(54), 74], [x(44), 84]])}" fill="${t[2]}"/>`,
      ].join("");
    };
    return `
      ${wing("left")}${wing("right")}
      <polygon points="${pts([[36, 30], [36, 10], [48, 22], [60, 4], [72, 22], [84, 10], [84, 30]])}" fill="${t[2]}"/>
      <polygon points="${pts([[40, 28], [40, 16], [48, 26], [60, 11], [72, 26], [80, 16], [80, 28]])}" fill="${t[0]}"/>
      <circle cx="60" cy="8" r="3.5" fill="${t[0]}" stroke="${t[2]}" stroke-width="1.5"/>
      <circle cx="36" cy="11" r="3" fill="${t[0]}" stroke="${t[2]}" stroke-width="1.5"/>
      <circle cx="84" cy="11" r="3" fill="${t[0]}" stroke="${t[2]}" stroke-width="1.5"/>
      <path d="M60 30 L92 38 L89 70 C86 90 74 102 60 110 C46 102 34 90 31 70 L28 38 Z" fill="${t[2]}"/>
      <clipPath id="${id}"><path d="M60 36 L86 43 L84 70 C81 86 71 96 60 102 C49 96 39 86 36 70 L34 43 Z"/></clipPath>
      <g clip-path="url(#${id})">
        <rect x="0" y="0" width="60" height="120" fill="${t[0]}"/>
        <rect x="60" y="0" width="60" height="120" fill="${t[1]}"/>
        <polygon points="${pts([[30, 86], [60, 70], [90, 86], [90, 120], [30, 120]])}" fill="${t[2]}" opacity="0.35"/>
      </g>`;
  },

  // Diamond — brilliant-cut gem throwing rays
  (t) => {
    const rays = regular(60, 58, 58, 12, 15).map(([x, y], i) => {
      const a = ((15 + 30 * i - 90) * Math.PI) / 180;
      const side = 5;
      const bx = 60 + 26 * Math.cos(a), by = 58 + 26 * Math.sin(a);
      const px = -Math.sin(a) * side, py = Math.cos(a) * side;
      return `<polygon points="${pts([[bx + px, by + py], [x, y], [bx - px, by - py]])}" fill="${t[0]}" opacity="0.55"/>`;
    }).join("");
    const g = { tl: [34, 34], tr: [86, 34], l: [18, 52], r: [102, 52], b: [60, 112], t1: [48, 34], t2: [72, 34], m1: [44, 52], m2: [60, 52], m3: [76, 52] };
    const f = (list, fill) => `<polygon points="${pts(list)}" fill="${fill}"/>`;
    return rays +
      f([g.tl, g.tr, g.r, g.b, g.l], t[2]) +                          // outline body
      f([g.l, g.tl, g.t1, g.m1], t[0]) +                               // crown, left
      f([g.t1, g.t2, g.m2], t[0]) +                                    // table, left half
      f([g.t2, g.m2, g.m3], t[1]) +                                    // table, right half
      f([g.t1, g.m1, g.m2], t[1]) +
      f([g.t2, g.tr, g.r, g.m3], t[1]) +                               // crown, right
      f([g.l, g.m1, g.b], t[0]) +                                      // pavilion, left
      f([g.m1, g.m2, g.b], t[1]) +
      f([g.m2, g.m3, g.b], t[2]) +
      f([g.m3, g.r, g.b], t[2]) +                                      // pavilion, right
      `<polygon points="${pts([[40, 38], [46, 38], [40, 48]])}" fill="#FFFFFF" opacity="0.8"/>`;
  },
];

const DIVISION_NUMERALS = ["I", "II", "III", "IV", "V"];

// SVG markup for a tier's emblem with its division numeral on a center plate.
function rankEmblem(tier, division, { label = true } = {}) {
  const tones = TIER_TONES[tier];
  const id = `emblem-clip-${++emblemCounter}`;
  const numeral = DIVISION_NUMERALS[division];
  const cy = tier === 4 ? 70 : tier === 5 ? 62 : 60;
  const plate = label
    ? `<circle cx="60" cy="${cy}" r="17" fill="${INK}" stroke="${tones[0]}" stroke-width="2"/>` +
      `<text x="60" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="'Space Mono', monospace" font-weight="700" font-size="${numeral.length > 2 ? 12 : 15}" fill="${tones[0]}">${numeral}</text>`
    : "";
  return `<svg class="emblem" viewBox="0 0 120 120" role="img" aria-label="${["Wood", "Copper", "Iron", "Silver", "Gold", "Diamond"][tier]} ${numeral}">${EMBLEMS[tier](tones, id)}${plate}</svg>`;
}
