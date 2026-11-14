import { fixed } from "./core/math.js";
import { tag, inkBox } from "./core/svg.js";
import { NAME } from "./brand.js";
import { sparkCurves } from "./mark.js";

/* ---------- wordmark ---------- */

export const LETTERING = { stroke: 0.24, width: 1, tracking: 0.35 };
export const SMALL_CAP_PX = 24;
export const X_DESIGN = {
  body: 1.9,
  arm: 1.2,
  clear: 0.35,
  heel: 2,
  tip: [4.2, -0.6],
  over: [
    [0.33, 0.7],
    [1.26, 0.06],
    [3, -0.52],
  ],
  under: [
    [3.75, -0.55],
    [2.56, -0.27],
    [1.09, 0.4],
  ],
};
export const CORNER = { outer: 1.2, inner: 0.2 },
  STAR_SIZE = 0.6,
  E_BAND = 0.7,
  R_ROOT = 0.5;
const LETTER_WIDTHS = {
  S: 1.35,
  T: 1.3,
  E: 1.2,
  L: 1.1,
  A: 1.6,
  R: 1.2,
  H: 1.25,
  X: X_DESIGN.body,
};
const LETTER_STEMS = { S: 2, T: 1, E: 1, L: 1, A: 2, R: 2, H: 2, X: 2 };
export const R_LEG_SLOPE = 1.2,
  E_ARM = 0.6;
function chain(start, controls, end) {
  const joints = controls.map((c, i) =>
    i < controls.length - 1
      ? [(c[0] + controls[i + 1][0]) / 2, (c[1] + controls[i + 1][1]) / 2]
      : end,
  );
  let from = start;
  return controls.map((c, i) => {
    const to = joints[i],
      lift = (p, q) => [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
    const cubic = [from, lift(from, c), lift(to, c), to];
    from = to;
    return cubic;
  });
}

const onCubic = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [0, 1].map(
    (k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k],
  );
};

const OFFSET_SAMPLES = 48;
const offsetChain = (cubics, gap, side) =>
  cubics.flatMap((cubic) =>
    Array.from({ length: OFFSET_SAMPLES }, (_, i) => {
      const t = i / OFFSET_SAMPLES,
        p = onCubic(cubic, t),
        q = onCubic(cubic, Math.min(1, t + 1e-3)),
        d = [q[0] - p[0], q[1] - p[1]],
        l = Math.hypot(...d);
      return [p[0] + (side * gap * d[1]) / l, p[1] - (side * gap * d[0]) / l];
    }),
  );

function rayHit(p, d, line) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      e = [b[0] - a[0], b[1] - a[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - p[0]) * e[1] - (a[1] - p[1]) * e[0]) / den,
      u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1)
      return { at: [p[0] + t * d[0], p[1] + t * d[1]], index: i - 1 + u };
  }
  throw new Error("the arm never meets the stroke");
}

const strokeAcross = (w, span) => {
  const a = 1 - w * w;
  return (-w * w * span + Math.sqrt(w ** 4 * span ** 2 + a * w * w * (span * span + 1))) / a;
};

function pen(x0) {
  let d = "";
  const thousandths = (v) => (Math.round(v * 10000) / 10).toString(),
    at = (x, y) => `${thousandths(x0 + x)} ${thousandths(y - 1)}`;
  const k = {
    M: (x, y) => ((d += `M${at(x, y)}`), k),
    L: (x, y) => ((d += `L${at(x, y)}`), k),
    A: (r, x, y, sweep) => (
      (d += `A${thousandths(r)} ${thousandths(r)} 0 0 ${sweep} ${at(x, y)}`),
      k
    ),
    Q: (x1, y1, x, y) => ((d += `Q${at(x1, y1)} ${at(x, y)}`), k),
    C: (x1, y1, x2, y2, x, y) => ((d += `C${at(x1, y1)} ${at(x2, y2)} ${at(x, y)}`), k),
    Z: () => ((d += "Z"), k),
    get d() {
      return d;
    },
  };
  return k;
}

export function letterforms({ stroke: w, width: f, star = true }) {
  const ro = CORNER.outer * w,
    ri = CORNER.inner * w,
    rootRadius = R_ROOT * w,
    low = (1 + w) / 2,
    band = w * E_BAND,
    eased = 1 - Math.SQRT1_2;
  const span = (c) =>
    LETTER_STEMS[c] * w + f * (LETTER_WIDTHS[c] - LETTER_STEMS[c] * LETTERING.stroke);
  return {
    S: [
      span("S"),
      (k) => {
        const W = span("S"),
          c1 = [ro, ro],
          c2 = [W - ro, 1 - ro];
        const v = [W / 2 - c1[0], 0.5 - c1[1]],
          a = Math.atan2(v[1], v[0]) - Math.asin(Math.min(1, (ri + w / 2) / Math.hypot(...v)));
        const n = [-Math.sin(a), Math.cos(a)],
          on = (c, r) => [c[0] + r * n[0], c[1] + r * n[1]];
        return k
          .M(W, w)
          .L(ro, w)
          .A(ri, w, ro, 0)
          .A(ri, ...on(c1, ri), 0)
          .L(...on(c2, -ro))
          .A(ro, W, 1 - ro, 1)
          .A(ro, W - ro, 1, 1)
          .L(0, 1)
          .L(0, 1 - w)
          .L(W - ro, 1 - w)
          .A(ri, W - w, 1 - ro, 0)
          .A(ri, ...on(c2, -ri), 0)
          .L(...on(c1, ro))
          .A(ro, 0, ro, 1)
          .A(ro, ro, 0, 1)
          .L(W, 0)
          .Z();
      },
      { turn: [ro * eased, ro * eased] },
    ],
    T: [
      span("T"),
      (k) => {
        const W = span("T"),
          x = (W - w) / 2;
        return k
          .M(0, 0)
          .L(W, 0)
          .L(W, w)
          .L(x + w, w)
          .L(x + w, 1)
          .L(x, 1)
          .L(x, w)
          .L(0, w)
          .Z();
      },
      { stem: [span("T") / 2, 1] },
    ],
    E: [
      span("E"),
      (k) => {
        const W = span("E"),
          arm = w + f * E_ARM;
        return k
          .M(0, 0)
          .L(W, 0)
          .L(W, band)
          .L(0, band)
          .Z()
          .M(0, 2 * band)
          .L(arm, 2 * band)
          .L(arm, 3 * band)
          .L(w, 3 * band)
          .L(w, 1 - w)
          .L(W, 1 - w)
          .L(W, 1)
          .L(ri, 1)
          .A(ri, 0, 1 - ri, 1)
          .Z();
      },
      { bars: [span("E") / 2, 0], middle: [w + f * E_ARM, 2.5 * band] },
    ],
    L: [
      span("L"),
      (k) => {
        const W = span("L");
        return k
          .M(0, 0)
          .L(w, 0)
          .L(w, 1 - ro)
          .A(ri, ro, 1 - w, 0)
          .L(W, 1 - w)
          .L(W, 1)
          .L(ri, 1)
          .A(ri, 0, 1 - ri, 1)
          .Z();
      },
    ],
    A: (() => {
      const W = span("A"),
        c = [W / 2, ro];
      const d = [c[0], c[1] - 1],
        a = Math.atan2(d[1], d[0]) - Math.asin(ro / Math.hypot(...d));
      const u = [Math.cos(a), Math.sin(a)],
        n = [u[1], -u[0]];
      const out = [c[0] + ro * n[0], c[1] + ro * n[1]],
        inn = [c[0] + ri * n[0], c[1] + ri * n[1]];
      const foot = inn[0] + ((1 - inn[1]) * u[0]) / u[1];
      const reach = ro * Math.tan(Math.acos(u[0]) / 2),
        rise = [u[0] * reach, 1 + u[1] * reach];
      return [
        W,
        (k) => {
          k.M(0, 1)
            .L(...out)
            .A(ro, W - out[0], out[1], 1)
            .L(W, 1)
            .L(W - foot + reach, 1)
            .A(ro, W - foot - rise[0], rise[1], 1)
            .L(W - inn[0], inn[1])
            .A(ri, ...inn, 0)
            .L(foot + rise[0], rise[1])
            .A(ro, foot - reach, 1, 1)
            .Z();
          if (!star) return k;
          for (const [command, ...numbers] of sparkCurves(W / 2, 0.5, STAR_SIZE * w))
            k[command](...numbers);
          return k.Z();
        },
        { star: [W / 2, 0.5], fillet: [foot - reach, 1] },
      ];
    })(),
    R: (() => {
      const W = span("R"),
        t = Math.atan(R_LEG_SLOPE / f),
        c = Math.cos(t),
        s = Math.sin(t),
        foot = w / s;
      const joint = W - ((1 - low) * c) / s,
        floor = low - w,
        reach = ro * Math.tan(t / 2);
      const along = (1 - rootRadius * c - (floor + rootRadius)) / s,
        x = W - foot - along * c,
        y = 1 - along * s;
      return [
        W,
        (k) => {
          k.M(0, 1)
            .L(0, ri)
            .A(ri, ri, 0, 1)
            .L(W - ro, 0)
            .A(ro, W, ro, 1)
            .L(W, low - ro);
          if (W - ro - joint > 5e-3) k.A(ro, W - ro, low, 1).L(joint, low);
          else {
            const dy = 1 - low + ro,
              b = ro * c + dy * s,
              hit = b - Math.sqrt(b * b - dy * dy);
            k.A(ro, W - hit * c, 1 - hit * s, 1);
          }
          return k
            .L(W, 1)
            .L(W - foot + reach, 1)
            .A(ro, W - foot - reach * c, 1 - reach * s, 1)
            .L(x, y)
            .A(rootRadius, x + rootRadius * s, floor, 1)
            .L(W - ro, floor)
            .A(ri, W - w, floor - ri, 0)
            .L(W - w, ro)
            .A(ri, W - ro, w, 0)
            .L(ro, w)
            .A(ri, w, ro, 0)
            .L(w, 1)
            .Z();
        },
        { leg: [(joint + W) / 2, (low + 1) / 2] },
      ];
    })(),
    H: [
      span("H"),
      (k) => {
        const W = span("H"),
          above = (1 - w) / 2,
          below = low;
        return k
          .M(0, 0)
          .L(w, 0)
          .L(w, above)
          .L(W - w, above)
          .L(W - w, 0)
          .L(W, 0)
          .L(W, 1)
          .L(W - w, 1)
          .L(W - w, below)
          .L(w, below)
          .L(w, 1)
          .L(0, 1)
          .Z();
      },
    ],
    X: (() => {
      const W = span("X"),
        stretch = (controls) => controls.map(([px, py]) => [(px * W) / X_DESIGN.body, py]);
      const heel = [X_DESIGN.heel * w, 1],
        chamfer = [ri, 1 - ri],
        [flightTip] = stretch([X_DESIGN.tip]);
      const upper = chain(chamfer, stretch(X_DESIGN.over), flightTip),
        lower = chain(flightTip, stretch(X_DESIGN.under), heel);
      const heavy = X_DESIGN.arm * w,
        clear = X_DESIGN.clear * w,
        t = strokeAcross(heavy, W - ri),
        run = W - ri - t,
        slope = 1 / run;
      return [
        W,
        (k) => {
          const arm = (corners, d, line) => {
            const ends = corners.map((c) => rayHit(c, d, line)),
              mid = line[Math.round((ends[0].index + ends[1].index) / 2)];
            const control = [
              2 * mid[0] - (ends[0].at[0] + ends[1].at[0]) / 2,
              2 * mid[1] - (ends[0].at[1] + ends[1].at[1]) / 2,
            ];
            return [
              ["M", ...corners[0]],
              ["L", ...corners[1]],
              ["L", ...ends[1].at],
              ["Q", ...control, ...ends[0].at],
            ];
          };
          const contours = [
            arm(
              [
                [ri, 0],
                [ri + t, 0],
              ],
              [1, slope],
              offsetChain(upper, clear, 1),
            ),
            [
              ["M", ...heel],
              ["L", 0, 1],
              ["L", ...chamfer],
              ...[...upper, ...lower].map((c) => ["C", ...c[1], ...c[2], ...c[3]]),
            ],
            arm(
              [
                [W, 1],
                [W - t, 1],
              ],
              [-1, -slope],
              offsetChain(lower, clear, 1),
            ),
          ];
          for (const contour of contours) {
            for (const [command, ...numbers] of contour) k[command](...numbers);
            k.Z();
          }
          return k;
        },
        { tip: flightTip },
      ];
    })(),
  };
}

export const SPACING = { depth: 0.15, rows: 250 };
export const KERNING = { HE: -0.08 };
const airs = {};

function sideAir([width, draw]) {
  const { depth, rows } = SPACING,
    across = Math.ceil(width * rows) + 2,
    canvas = document.createElement("canvas");
  canvas.width = across;
  canvas.height = rows;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.setTransform(rows / 1000, 0, 0, rows / 1000, 1, rows);
  g.fill(new Path2D(draw(pen(0)).d));
  const ink = g.getImageData(0, 0, across, rows).data,
    left = [],
    right = [];
  for (let y = 0; y < rows; y++) {
    let first = -1,
      last = -1;
    for (let x = 0; x < across; x++)
      if (ink[(y * across + x) * 4 + 3] > 127) {
        if (first < 0) first = x;
        last = x;
      }
    left.push(first < 0 ? width : (first - 1) / rows);
    right.push(last < 0 ? width : width - (last - 1) / rows);
  }
  const mean = (side) => side.reduce((total, gap) => total + Math.min(gap, depth), 0) / rows;
  return { left: mean(left), right: mean(right) };
}

function layWord(lettering) {
  const forms = letterforms(lettering),
    letters = [...NAME.toUpperCase()],
    key = `${lettering.stroke}|${lettering.width}|${lettering.star}`;
  const air = (airs[key] ??= Object.fromEntries(
    [...new Set(letters)].map((char) => [char, sideAir(forms[char])]),
  ));
  const white = letters.slice(1).map((char, i) => air[letters[i]].right + air[char].left);
  const even = white.reduce((total, gap) => total + gap, 0) / white.length;
  let cursor = 0,
    d = "",
    axis = 0;
  const starts = [];
  letters.forEach((char, i) => {
    starts.push(cursor);
    d += forms[char][1](pen(cursor)).d;
    if (char === "A") axis = cursor + forms[char][0] / 2;
    cursor +=
      forms[char][0] +
      (i < white.length
        ? lettering.tracking + even - white[i] + (KERNING[char + letters[i + 1]] ?? 0)
        : 0);
  });
  return { width: cursor, axis, d, starts };
}

export const WORDMARK = layWord(LETTERING);

export const wordmark = (x, baseline, cap, fill, word = WORDMARK) =>
  tag("path", {
    fill,
    transform: `translate(${fixed(x)} ${fixed(baseline)}) scale(${(cap / 1000).toFixed(5)})`,
    d: word.d,
  });

export const wordBox = (word) => {
  const { x, y, width, height } = inkBox(wordmark(0, 0, 100, "currentColor", word));
  return [x, y, width, height];
};
export const wordView = (word) => `0 -100 ${fixed(100 * word.width)} 100`;
export const wordSvg = (word, attributes) =>
  tag(
    "svg",
    { viewBox: wordView(word), overflow: "visible", ...attributes },
    wordmark(0, 0, 100, "currentColor", word),
  );
