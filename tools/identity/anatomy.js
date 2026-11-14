import {
  SQRT3,
  apothem,
  radians,
  degrees,
  turn,
  onCircle,
  fixed,
  short,
  once,
} from "./core/math.js";
import { hexagon, points, tag } from "./core/svg.js";
import { NAME } from "./brand.js";
import { MONO, monoAdvance } from "./mono.js";
import { inUnits, MIRROR, STATE } from "./mark.js";
import {
  LETTERING,
  X_DESIGN,
  CORNER,
  STAR_SIZE,
  E_BAND,
  R_ROOT,
  R_LEG_SLOPE,
  E_ARM,
  letterforms,
  SPACING,
  KERNING,
  WORDMARK,
  wordmark,
} from "./wordmark.js";

/* ---------- construction ---------- */

const GUIDE = "var(--color-ink-muted)";
const dashed = { "stroke-dasharray": "1.5 1.5" };
const guide = { fill: "none", stroke: GUIDE, "stroke-width": ".4" };
const hair = { ...guide, "stroke-width": ".3" };
const guideLine = (a, b, style) =>
  tag("line", { x1: fixed(a[0]), y1: fixed(a[1]), x2: fixed(b[0]), y2: fixed(b[1]), ...style });
const LABEL_SIZE = 3.4,
  LINE = LABEL_SIZE * 1.4;

const ratioText = (value) => {
  const d = [1, 2, 3, 4, 6, 8, 12].find((n) => Math.abs(value * n - Math.round(value * n)) < 1e-9);
  return d > 1 ? `${Math.round(value * d)}/${d}` : short(value);
};
const SEGMENT_GAP = inUnits(2 * apothem(MIRROR.segmentRadius) * (1 - MIRROR.fill));

const guideLabel = (x, y, text, anchor = "start", baseline = null) =>
  tag(
    "text",
    {
      x,
      y,
      "font-family": MONO,
      "font-size": LABEL_SIZE,
      fill: GUIDE,
      "text-anchor": anchor,
      "dominant-baseline": baseline,
    },
    text,
  );

const ANATOMY_HALF = 60,
  SHEET_MARGIN = 1.5;
const SHEET_WIDE = 100;
export const sheetView = (half) => `${-SHEET_WIDE} ${-half} ${2 * SHEET_WIDE} ${2 * half}`;
const COLUMN = MIRROR.outline + 4;
const AXIS_REACH = { x: MIRROR.outline + 2, y: MIRROR.outline };
const AXES =
  tag("line", { x1: -AXIS_REACH.x, y1: 0, x2: AXIS_REACH.x, y2: 0, ...guide, ...dashed }) +
  tag("line", { x1: 0, y1: -AXIS_REACH.y, x2: 0, y2: AXIS_REACH.y, ...guide, ...dashed });

const LOWER_LEFT = 120,
  UPPER_LEFT = 240;

function angleMarks(rays, flatEdge) {
  const arc = flatEdge + 1.2;
  const upward = [...new Set(rays.map((angle) => turn(-angle)))]
    .filter((angle) => angle > 0 && angle <= 90)
    .sort((a, b) => a - b);
  return upward
    .map((angle) => {
      if (angle === 90) return guideLabel(2.5, -AXIS_REACH.y - 2, "90°");
      const [x, y] = onCircle(arc, -angle),
        [lx, ly] = onCircle(arc + 2, -angle / 2);
      return (
        tag("path", {
          d: `M${fixed(arc)},0 A${fixed(arc)},${fixed(arc)} 0 0 0 ${fixed(x)},${fixed(y)}`,
          ...guide,
        }) + guideLabel(fixed(lx), fixed(ly), angle + "°", "start", "central")
      );
    })
    .join("");
}
const STRUT_ANGLE_MARKS = angleMarks(MIRROR.strutAngles, apothem(MIRROR.outline));

const circleGuide = (radius) => tag("circle", { r: fixed(radius), ...guide, ...dashed });
const lineGuide = (a, b) => guideLine(a, b, { ...guide, ...dashed });
const hull = (radius) =>
  tag("polygon", { points: points(hexagon(radius)), ...guide, transform: "rotate(30)" });
const MIRROR_HULL = hull(MIRROR.outline);

/* ---------- notes ---------- */

const ROW_GAP = LINE * 1.4;
const LEFT = -1,
  RIGHT = 1;

const plus = ([x, y], [dx, dy], k = 1) => [x + dx * k, y + dy * k];
const note = (side, at, ...lines) => ({ side, at, lines, height: (lines.length - 1) * LINE });
const textWidth = (text) => [...text].length * (LABEL_SIZE * monoAdvance());
const lineWidth = (line) => textWidth(line.replace(/[[\]]/g, ""));
const leader = (...corners) =>
  tag("circle", { cx: fixed(corners[0][0]), cy: fixed(corners[0][1]), r: ".6", fill: GUIDE }) +
  tag("polyline", { points: points(corners), ...hair });

const STUB = 2.5,
  LABEL_BOX = { pad: 0.45, rise: 0.66 };
const callout = (at, x, y, side, lines) =>
  leader(at, [x, y], [x + side * STUB, y]) +
  lines.map((line, i) => figureLine(x + side * (STUB + 1), y + i * LINE, line, side)).join("");

function figureLine(x, y, line, side) {
  const step = LABEL_SIZE * monoAdvance(),
    parts = line.split(/[[\]]/);
  let cursor = side < 0 ? x - lineWidth(line) : x,
    boxes = "",
    spans = "";
  parts.forEach((part, i) => {
    const text = part.trim(),
      lead = [...part].length - [...part.trimStart()].length,
      width = textWidth(text);
    if (text)
      spans += tag(
        "tspan",
        {
          x: fixed(cursor + lead * step),
          textLength: fixed(width),
          lengthAdjust: "spacingAndGlyphs",
        },
        text,
      );
    if (text && i % 2)
      boxes += tag("rect", {
        x: fixed(cursor - LABEL_BOX.pad),
        y: fixed(y - LABEL_SIZE * LABEL_BOX.rise),
        width: fixed(width + 2 * LABEL_BOX.pad),
        height: fixed(2 * LABEL_SIZE * LABEL_BOX.rise),
        ...hair,
      });
    cursor += [...part].length * step;
  });
  return (
    boxes +
    tag(
      "text",
      {
        y: fixed(y),
        "font-family": MONO,
        "font-size": LABEL_SIZE,
        fill: GUIDE,
        "dominant-baseline": "central",
      },
      spans,
    )
  );
}

function callouts(notes) {
  return [LEFT, RIGHT]
    .map((side) => {
      const column = notes.filter((entry) => entry.side === side).sort((a, b) => a.at[1] - b.at[1]);
      let y = -(column.reduce((total, entry) => total + entry.height + ROW_GAP, 0) - ROW_GAP) / 2;
      return column
        .map((entry) => {
          const markup = callout(entry.at, side * COLUMN, y, side, entry.lines);
          y += entry.height + ROW_GAP;
          return markup;
        })
        .join("");
    })
    .join("");
}

const sheetTitle = (name, unit, legend, half) =>
  figureLine(-SHEET_WIDE + SHEET_MARGIN, LINE - half, name.toUpperCase(), 1) +
  figureLine(SHEET_WIDE - SHEET_MARGIN, LINE - half, unit, -1) +
  figureLine(-SHEET_WIDE + SHEET_MARGIN, half - LINE, legend, 1);

/* ---------- mark sheet ---------- */

const ccw = (angle) => turn(-angle);

const distance = (a, b) => Math.hypot(...plus(a, b, -1));
const nearestTo = (point, candidates) =>
  candidates.reduce((best, candidate) =>
    distance(candidate, point) < distance(best, point) ? candidate : best,
  );
const SHOWN = nearestTo(onCircle(SQRT3 * MIRROR.pitch, LOWER_LEFT), MIRROR.centres),
  NEIGHBOUR = plus(SHOWN, [0, -MIRROR.pitch]);
const RING_ONE = MIRROR.centres.filter(
  (centre) => Math.abs(Math.hypot(...centre) - MIRROR.pitch) < 1e-6,
).length;
const OPEN_CENTRE = MIRROR.pitch - apothem(MIRROR.segment);
const CORNER_ANGLE = ccw(Math.round(degrees(Math.atan2(hexagon(1)[0][1], hexagon(1)[0][0]))));
const FLATS = hexagon(1).map(([x, y]) => degrees(Math.atan2(y, x)));
const hullReach = (point) =>
  Math.max(
    ...FLATS.map(
      (angle) => point[0] * Math.cos(radians(angle)) + point[1] * Math.sin(radians(angle)),
    ),
  );
const onHull = (candidates, radius) =>
  candidates.filter((point) => Math.abs(hullReach(point) - apothem(radius)) < 1e-6).length;
const CELL_CORNERS = MIRROR.centres.flatMap((centre) => hexagon(MIRROR.segmentRadius, ...centre));
const SEGMENT_GUIDES =
  tag("polygon", { points: points(hexagon(MIRROR.segmentRadius, ...SHOWN)), ...guide, ...dashed }) +
  lineGuide(NEIGHBOUR, SHOWN);
const MIRROR_NOTES = [
  note(
    LEFT,
    onCircle(MIRROR.rim, UPPER_LEFT),
    `EDGE ${inUnits(MIRROR.rim)} FROM CENTRE`,
    "= 2 PITCH + √3/2 r",
  ),
  note(
    LEFT,
    onCircle(apothem(MIRROR.outline), UPPER_LEFT),
    `HULL ${inUnits(apothem(MIRROR.outline))} TO FLATS = ${ratioText(apothem(MIRROR.outline) / MIRROR.segmentRadius)} R`,
    `${onHull(CELL_CORNERS, MIRROR.outline)} CELL CORNERS ON IT`,
  ),
  note(
    LEFT,
    onCircle(SQRT3 * MIRROR.pitch, UPPER_LEFT),
    `${MIRROR.centres.length} SEGMENTS`,
    `= ${RING_ONE} + ${MIRROR.centres.length - RING_ONE}, CENTRE OPEN`,
  ),
  note(
    LEFT,
    NEIGHBOUR.map((value) => (value * OPEN_CENTRE) / MIRROR.pitch),
    `OPEN CENTRE ${inUnits(OPEN_CENTRE)}`,
    "= PITCH − √3/2 r",
  ),
  note(LEFT, NEIGHBOUR, `PITCH ${inUnits(MIRROR.pitch)}`, "= √3 R"),
  note(
    LEFT,
    plus(SHOWN, [0, -apothem(MIRROR.segmentRadius)]),
    `GAP ${SEGMENT_GAP}`,
    "= √3 R (1 − FILL)",
  ),
  note(
    LEFT,
    plus(SHOWN, [-MIRROR.segment, 0]),
    `SEGMENT r ${inUnits(MIRROR.segment)}`,
    `= FILL [${MIRROR.fill}] × R`,
  ),
  note(
    LEFT,
    plus(SHOWN, onCircle(MIRROR.segmentRadius, 120)),
    `CELL R [${inUnits(MIRROR.segmentRadius)}] u, CORNER AT ${CORNER_ANGLE}°`,
  ),
];
const STRUT_NOTES = [
  note(
    RIGHT,
    onCircle(1.5 * MIRROR.pitch, MIRROR.strutAngles[1]),
    `${MIRROR.strutAngles.length} STRUTS, WIDTH [${inUnits(MIRROR.strutWidth)}]`,
    `AT ${MIRROR.strutAngles
      .map(ccw)
      .sort((a, b) => a - b)
      .map((angle) => `[${angle}]`)
      .join(" ")} DEGREES`,
    "CENTRE TO EDGE",
  ),
];

const NOTES = [...MIRROR_NOTES, ...STRUT_NOTES];
const markSheet = () =>
  sheetTitle(
    STATE.name,
    `UNIT u = R/${inUnits(MIRROR.segmentRadius)} · ANGLES CCW`,
    "[N] CHOSEN · = DERIVED · R CELL RADIUS · r SEGMENT RADIUS",
    ANATOMY_HALF,
  ) +
  STATE.mark() +
  MIRROR_HULL +
  circleGuide(MIRROR.rim) +
  STRUT_ANGLE_MARKS +
  SEGMENT_GUIDES +
  AXES +
  callouts(NOTES);

/* ---------- wordmark sheet ---------- */

const hairline = (a, b) => guideLine(a, b, hair);

function dimension(a, b, ...marks) {
  const length = distance(a, b),
    across = [(a[1] - b[1]) / length, (b[0] - a[0]) / length];
  return (
    hairline(a, b) +
    [a, b, ...marks]
      .map((point) => hairline(plus(point, across, -1), plus(point, across, 1)))
      .join("")
  );
}

const NOTE_PAD = 1.5,
  NOTE_SPACE = 6;

function stackNotes(notes) {
  if (!notes.length) return { placed: [], rows: 0 };
  const limit = SHEET_WIDE - SHEET_MARGIN,
    width = (text) => STUB + 1 + lineWidth(text);
  const span = ({ x, text }, side) => (side > 0 ? [x, x + width(text)] : [x - width(text), x]);
  const clear = (x, [a, b]) => x < a - NOTE_PAD || x > b + NOTE_PAD;
  const apart = ([a, b], [c, d]) => b + NOTE_SPACE < c || d + NOTE_SPACE < a;
  const fits = (placed, entry, row, side) => {
    const own = span(entry, side);
    return (
      own[0] >= -limit &&
      own[1] <= limit &&
      placed.every((other) => {
        const theirs = span(other, other.side);
        if (other.row === row) return apart(own, theirs);
        return other.row < row ? clear(entry.x, theirs) : clear(other.x, own);
      })
    );
  };
  const fill = (placed, rest, rows) => {
    if (!rest.length) return placed;
    const [entry, ...others] = rest;
    for (let row = 0; row < rows; row++)
      for (const side of [1, -1]) {
        const done =
          fits(placed, entry, row, side) &&
          fill([...placed, { ...entry, row, side }], others, rows);
        if (done) return done;
      }
    return null;
  };
  const ordered = [...notes].sort((a, b) => a.x - b.x);
  for (let rows = 1; rows <= notes.length; rows++) {
    const placed = fill([], ordered, rows);
    if (placed) return { placed, rows };
  }
  throw new Error("the notes do not fit the sheet");
}

const plannedWord = once(planWordSheet);
const FIRST_ROW = 1.3,
  TIP_RUN = 2.5;

function planWordSheet() {
  const word = WORDMARK,
    name = NAME.toUpperCase(),
    letters = [...name],
    forms = letterforms(LETTERING),
    w = LETTERING.stroke;
  const spans = letters.map((char) => forms[char][0]),
    last = letters.length - 1;
  const point = (i, key) => {
    const [x, y] = forms[letters[i]][2][key];
    return [word.starts[i] + x, y];
  };
  const gap = (i) => (word.starts[i] + spans[i] + word.starts[i + 1]) / 2;
  const tip = point(last, "tip"),
    rise = -tip[1],
    cap = (SHEET_WIDE - SHEET_MARGIN - 2 * TIP_RUN) / (tip[0] - word.width / 2),
    left = (-word.width * cap) / 2;
  const firstE = name.indexOf("E"),
    middleE = name.lastIndexOf("E");
  const label = (at, text, via = at[0]) => ({ at, text, x: left + via * cap });
  const above = [
    label(
      point(name.indexOf("S"), "turn"),
      `TURNS r [${short(CORNER.outer)}] w OUT, [${short(CORNER.inner)}] w IN`,
    ),
    label(point(firstE, "bars"), `E UPPER BARS [${short(E_BAND)}] w`),
    label(point(middleE, "middle"), `E MIDDLE BAR [${short(E_ARM)}] PAST THE STEM`, gap(middleE)),
    label(tip, `TAIL TIP [${short(X_DESIGN.tip[0])}] FROM THE X, [${short(rise)}] OVER THE CAP`),
  ];
  const below = [
    label([gap(0), 0.5], `TRACKING [${short(LETTERING.tracking)}]`),
    label(point(name.indexOf("T"), "stem"), `STROKE w [${short(w)}]`),
    label(point(name.indexOf("A"), "fillet"), `FILLET r = ${short(CORNER.outer)} w`),
    label(point(name.indexOf("A"), "star"), `STAR r [${short(STAR_SIZE)}] w`),
    label(point(name.indexOf("R"), "leg"), `R LEG SLOPE [${short(R_LEG_SLOPE)}]`),
    ...Object.entries(KERNING).map(([pair, value]) =>
      label([gap(name.indexOf(pair)), 0.5], `KERN ${pair} [${short(value).replace("-", "−")}]`),
    ),
  ];
  const rules = [
    `SPACING READS [${short(SPACING.depth)}] INTO EACH SIDE · CORNERS r [${short(CORNER.inner)}] w · T, H SQUARE`,
    `X: ARMS [${short(X_DESIGN.arm)}] w, [${short(X_DESIGN.clear)}] w OFF THE TAIL, FOOT [${short(X_DESIGN.heel)}] w` +
      ` · R: ROOT r [${short(R_ROOT)}] w · E: BARS ONE BAR APART`,
    "ON HALF CAP: H BAR, R FLOOR AND THE A STAR, DRAWN AS THE SEAL SPARK",
  ];
  const top = stackNotes(above),
    bottom = stackNotes(below),
    ruler = (bottom.rows + FIRST_ROW) * ROW_GAP;
  const up = cap * (1 + rise) + top.rows * ROW_GAP,
    down = ruler + 2 * LINE + 2 * ROW_GAP + (rules.length - 1) * LINE;
  return {
    word,
    spans,
    last,
    tip,
    cap,
    left,
    top,
    bottom,
    rules,
    ruler,
    up,
    down,
    half: Math.ceil((up + down) / 2 + LINE + 1.5 * ROW_GAP),
  };
}

function wordSheet() {
  const { word, spans, last, cap, left, top, bottom, rules, up, down, half, ...plan } =
    plannedWord();
  const baseline = (up - down) / 2,
    capLine = baseline - cap,
    at = ([x, y]) => [left + x * cap, capLine + y * cap];
  const tip = at(plan.tip),
    edge = tip[0] + TIP_RUN,
    ruleX = left - 3,
    ruler = baseline + plan.ruler;
  const rowAbove = (row) => tip[1] - (row + 1) * ROW_GAP,
    rowBelow = (row) => baseline + (row + FIRST_ROW) * ROW_GAP;
  const markup = ({ at: spot, x, text, side }, y) => {
    const [ax, ay] = at(spot),
      corners =
        x === ax
          ? [[ax, ay]]
          : [
              [ax, ay],
              [x, ay],
            ];
    return (
      leader(...corners, [x, y], [x + side * STUB, y]) +
      figureLine(x + side * (STUB + 1), y, text, side)
    );
  };
  const centred = (line, x, y) => figureLine(x - lineWidth(line) / 2, y, line, 1);
  const bounds = word.starts
    .flatMap((start, i) => [start, start + spans[i]])
    .slice(1, -1)
    .map((x) => [left + x * cap, ruler]);
  return (
    sheetTitle(
      "Wordmark",
      "UNIT C = CAP HEIGHT",
      "[N] CHOSEN · = DERIVED · C CAP HEIGHT · w STROKE · r RADIUS",
      half,
    ) +
    lineGuide([ruleX, capLine], [edge, capLine]) +
    lineGuide([ruleX, baseline], [edge, baseline]) +
    lineGuide([left + word.starts[last] * cap, tip[1]], [edge, tip[1]]) +
    dimension([ruleX, capLine], [ruleX, baseline]) +
    guideLabel(fixed(ruleX - 1.5), fixed(baseline - cap / 2), "C", "end", "central") +
    dimension([left, ruler], [-left, ruler], ...bounds) +
    hairline([0, ruler - 3], [0, ruler + 1]) +
    lineGuide([-left, ruler], [tip[0], ruler]) +
    hairline([tip[0], ruler - 1], [tip[0], ruler + 1]) +
    centred(short(plan.tip[0] - word.width), (tip[0] - left) / 2, ruler + LINE) +
    spans
      .map((span, i) =>
        centred(`[${short(span)}]`, left + (word.starts[i] + span / 2) * cap, ruler + LINE),
      )
      .join("") +
    spans
      .slice(0, -1)
      .map((span, i) => {
        const end = word.starts[i] + span;
        return centred(
          short(word.starts[i + 1] - end),
          left + ((end + word.starts[i + 1]) / 2) * cap,
          ruler + 2 * LINE,
        );
      })
      .join("") +
    centred(
      `LETTER WIDTHS, GAPS UNDER · LETTERS ${short(word.width)} C WIDE, CENTRED; TAIL LEFT OUT`,
      0,
      ruler + 2 * LINE + ROW_GAP,
    ) +
    rules.map((rule, i) => centred(rule, 0, ruler + 2 * LINE + 2 * ROW_GAP + i * LINE)).join("") +
    wordmark(left, baseline, cap, "currentColor") +
    top.placed.map((entry) => markup(entry, rowAbove(entry.row))).join("") +
    bottom.placed.map((entry) => markup(entry, rowBelow(entry.row))).join("")
  );
}

/* ---------- sheets ---------- */

export const SHEETS = {
  anatomy: {
    half: () => ANATOMY_HALF,
    draw: markSheet,
    label: `${STATE.name}: construction drawing`,
    about: "the construction drawing of the mark",
  },
  "wordmark-anatomy": {
    half: () => plannedWord().half,
    draw: wordSheet,
    label: `${NAME} wordmark: construction drawing`,
    about: "the construction drawing of the wordmark",
  },
};
