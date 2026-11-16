import { clamp01, radians, onCircle, fixed, easeInOut, seeded } from "../core/math.js";
import { all, reducedMotion } from "../core/dom.js";
import { RELATIVE, lighten } from "../core/colour.js";
import { MARK_HALF, hexagon, pointsOf, tag, uniqueId } from "../core/svg.js";
import { MIRROR, markSvg } from "../identity/mark.js";
import { CAMERA, MIRROR_LAYOUT, SOLID } from "./scene.js";
import { glMirror } from "./webgl.js";

/* ---------- mirror ---------- */

export function initMirror(holder, stage) {
  const rim = MIRROR.rim,
    focal = rim ** 2 / (4 * SOLID.sag),
    slope = (value) => value / (2 * focal),
    { wave } = SOLID;
  const unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const shade = (lift) => lighten("var(--brand)", lift);
  const crest = (lift) => (RELATIVE ? shade(lift) : "var(--brand)");
  const sun = unit(SOLID.sun);
  const segments = MIRROR.centres.map(([cx, cy]) => {
    const normal = unit([-slope(cx), -slope(cy), 1]),
      cz = (cx * cx + cy * cy - rim * rim) / (4 * focal),
      centre = [cx, cy, cz];
    const front = hexagon(MIRROR.segment, cx, cy).map(([x, y]) => [
      x,
      y,
      cz + (x - cx) * slope(cx) + (y - cy) * slope(cy),
    ]);
    const back = front.map((point) => point.map((value, i) => value - SOLID.thickness * normal[i]));
    const walls = front.map((a, i) => {
      const b = front[(i + 1) % 6],
        quad = [a, b, back[(i + 1) % 6], back[i]];
      const mid = quad.reduce(
        (sum, point) => sum.map((value, k) => value + point[k] / 4),
        [0, 0, 0],
      );
      const out = unit(cross(sub(b, a), sub(back[i], a)));
      return { quad, out: dot(out, sub(mid, centre)) < 0 ? out.map((value) => -value) : out };
    });
    const across = unit(
        sub(
          [1, 0, 0],
          normal.map((value) => value * normal[0]),
        ),
      ),
      down = cross(normal, across);
    return { centre, normal, front, walls, across, down, radial: Math.atan2(cy, cx) };
  });
  const struts = MIRROR.strutAngles.map((angle) => [
    [...onCircle(rim, angle), 0],
    [0, 0, SOLID.apex],
  ]);
  const secondary = hexagon(SOLID.secondary).map(([x, y]) => [x, y, SOLID.apex]);
  const dish = [0, 0, -SOLID.sag];
  const random = seeded(3);
  const own = segments.map(() => ({
    apart: (random() - 0.5) * 2 * Math.PI,
    density: wave.density[0] + random() * (wave.density[1] - wave.density[0]),
    piston: random(),
    beat: random() * 2 * Math.PI,
  }));

  const clipId = uniqueId("faces"),
    waveId = uniqueId("wave");
  const stripes = [
    [0, wave.trough],
    [0.25, (wave.trough + wave.crest) / 2],
    [0.5, wave.crest],
    [0.75, (wave.trough + wave.crest) / 2],
    [1, wave.trough],
  ];
  holder.innerHTML = markSvg(
    tag(
      "defs",
      {},
      tag("clipPath", { id: clipId }, tag("polygon", {}).repeat(segments.length)) +
        segments
          .map((_, i) =>
            tag(
              "linearGradient",
              { id: `${waveId}-${i}`, gradientUnits: "userSpaceOnUse", spreadMethod: "repeat" },
              stripes
                .map(([offset, lift]) =>
                  tag("stop", { offset, style: `stop-color: ${crest(lift)}` }),
                )
                .join(""),
            ),
          )
          .join(""),
    ) +
      tag("g", {}, tag("polygon", {}).repeat(6 * segments.length)) +
      tag(
        "g",
        {
          style: `stroke: ${shade(SOLID.bevel[1])}`,
          "stroke-width": SOLID.bevel[0],
          "stroke-linejoin": "round",
        },
        segments.map((_, i) => tag("polygon", { fill: `url(#${waveId}-${i})` })).join(""),
      ) +
      tag(
        "g",
        { style: `fill: ${shade(SOLID.flash.lift)}` },
        tag("polygon", { opacity: 0 }).repeat(segments.length),
      ) +
      tag(
        "g",
        {
          "clip-path": `url(#${clipId})`,
          fill: "black",
          stroke: "black",
          opacity: SOLID.shadow[0],
        },
        tag("line", {}).repeat(struts.length) + tag("polygon", {}),
      ) +
      tag("line", { stroke: "var(--mark-cut)" }).repeat(struts.length) +
      tag("polygon", { fill: "var(--mark-cut)" }),
    "cover__mark-art",
  );
  const svg = holder.firstElementChild,
    [wallGroup, faceGroup, glintGroup, shadows] = svg.querySelectorAll(":scope > g");
  const wallNodes = [...wallGroup.children],
    faces = [...faceGroup.children],
    glints = [...glintGroup.children];
  const { point, corners, face, wall, stripe, shadow, strut } = MIRROR_LAYOUT,
    count = segments.length,
    centres = segments.map(() => [0, 0]),
    focus = [0, 0];
  const geometry = {
    faces: new Float64Array(face * count),
    stripes: new Float64Array(stripe * count),
    flashes: new Float64Array(count),
    wallVisible: new Uint8Array(corners * count),
    wallLift: new Float64Array(corners * count),
    wallQuads: new Float64Array(corners * wall * count),
    strutLines: new Float64Array(strut * struts.length),
    cap: new Float64Array(face),
    capShadow: new Float64Array(face),
  };
  const {
    faces: faceBuffer,
    stripes: stripeLines,
    flashes,
    wallVisible,
    wallLift,
    wallQuads,
    strutLines,
  } = geometry;
  let last = 0;
  const clips = all(svg, "clipPath polygon"),
    waves = all(svg, "linearGradient"),
    lines = all(svg, ":scope > line");
  const shadowLines = all(shadows, "line"),
    shadowCap = shadows.querySelector("polygon"),
    cap = svg.lastElementChild;
  const gpu = glMirror(holder, svg);
  let viewDistance = 0;
  const fitView = () => {
    viewDistance = ((CAMERA.depth * stage.clientWidth) / holder.clientWidth) * 2 * MARK_HALF;
  };
  fitView();
  new ResizeObserver(fitView).observe(holder);

  let cy = 1,
    sy = 0,
    cp = 1,
    sp = 0;
  const up = [0, 0, 1],
    dishCentre = new Float64Array(point),
    dishNormal = new Float64Array(point);
  const rotated = new Float64Array(point),
    castPoint = new Float64Array(point);
  const seen = new Float64Array(face),
    ends = new Float64Array(2 * point),
    shadowEnds = new Float64Array(2 * point);
  const unitK = new Float64Array(point),
    start = new Float64Array(point),
    end = new Float64Array(point);
  const rotateAt = (from, out, o) => {
    const x = from[0],
      y = from[1],
      z = from[2],
      z1 = z * cy - x * sy;
    out[o] = x * cy + z * sy;
    out[o + 1] = y * cp - z1 * sp;
    out[o + 2] = y * sp + z1 * cp;
  };
  const flatAt = (from, f, out, o) => {
    const k = viewDistance / (viewDistance - from[f + 2]);
    out[o] = from[f] * k;
    out[o + 1] = from[f + 1] * k;
    out[o + 2] = k;
  };
  const projectAt = (from, out, o) => {
    rotateAt(from, rotated, 0);
    flatAt(rotated, 0, out, o);
  };
  const castAt = (from, f, out, o) => {
    const k =
      (dishNormal[0] * (from[f] - dishCentre[0]) +
        dishNormal[1] * (from[f + 1] - dishCentre[1]) +
        dishNormal[2] * (from[f + 2] - dishCentre[2])) /
      (dishNormal[0] * sun[0] + dishNormal[1] * sun[1] + dishNormal[2] * sun[2]);
    out[o] = from[f] - sun[0] * k;
    out[o + 1] = from[f + 1] - sun[1] * k;
    out[o + 2] = from[f + 2] - sun[2] * k;
  };
  const lineAt = (element, o) => {
    element.setAttribute("x1", fixed(strutLines[o]));
    element.setAttribute("y1", fixed(strutLines[o + 1]));
    element.setAttribute("x2", fixed(strutLines[o + 2]));
    element.setAttribute("y2", fixed(strutLines[o + 3]));
    element.setAttribute("stroke-width", fixed(strutLines[o + 4]));
  };

  const frame = (time) => {
    const dt = time - last,
      dim = Math.exp(-dt / SOLID.flash.decay);
    last = time;
    const risen = reducedMotion ? 1 : easeInOut(clamp01(time / SOLID.rise)),
      swing = Math.PI + (2 * Math.PI * time) / SOLID.period;
    const yaw = radians(risen * SOLID.yaw * Math.sin(swing)),
      pitch = radians(risen * (SOLID.tilt + SOLID.pitch * Math.cos(swing)));
    cy = Math.cos(yaw);
    sy = Math.sin(yaw);
    cp = Math.cos(pitch);
    sp = Math.sin(pitch);
    rotateAt(dish, dishCentre, 0);
    rotateAt(up, dishNormal, 0);
    const arrayed = (1 - Math.cos((2 * Math.PI * time) / wave.cycle)) / 2,
      free = 1 - arrayed;

    for (let i = 0; i < count; i++) {
      const { centre, front, walls, across, down, radial } = segments[i],
        f = face * i;
      for (let c = 0; c < front.length; c++) projectAt(front[c], faceBuffer, f + point * c);
      const drawn = gpu ? "" : pointsOf(faceBuffer, f, front.length);
      for (let w = 0; w < walls.length; w++) {
        const { quad, out } = walls[w],
          index = walls.length * i + w;
        rotateAt(out, rotated, 0);
        const visible = rotated[2] > SOLID.edgeOn;
        const lift =
          SOLID.wall[0] +
          SOLID.wall[1] *
            Math.max(0, rotated[0] * sun[0] + rotated[1] * sun[1] + rotated[2] * sun[2]);
        wallVisible[index] = visible ? 1 : 0;
        wallLift[index] = lift;
        if (visible)
          for (let c = 0; c < quad.length; c++)
            projectAt(quad[c], wallQuads, wall * index + point * c);
        if (gpu) continue;
        wallNodes[index].setAttribute(
          "points",
          visible ? pointsOf(wallQuads, wall * index, quad.length) : "",
        );
        if (visible) wallNodes[index].style.fill = shade(lift);
      }
      const onScreen = centres[i];
      onScreen[0] = onScreen[1] = 0;
      for (let c = 0; c < front.length; c++) {
        onScreen[0] += faceBuffer[f + point * c] / front.length;
        onScreen[1] += faceBuffer[f + point * c + 1] / front.length;
      }
      flashes[i] *= dim;
      const { apart, density, piston, beat: tick } = own[i];
      const turned = radial + (apart + wave.wander * Math.sin(time * wave.tempo[0] + tick)) * free;
      const strength =
        1 + (density * (1 + wave.breath * Math.sin(time * wave.tempo[1] + tick)) - 1) * free;
      for (let m = 0; m < 3; m++)
        unitK[m] = across[m] * Math.cos(turned) + down[m] * Math.sin(turned);
      const wavelength = wave.pitch / strength;
      const at =
        ((((unitK[0] * centre[0] + unitK[1] * centre[1] + unitK[2] * centre[2]) / wavelength +
          piston -
          wave.crests * time) %
          1) +
          1) %
        1;
      for (let m = 0; m < 3; m++) {
        start[m] = centre[m] - unitK[m] * at * wavelength;
        end[m] = start[m] + unitK[m] * wavelength;
      }
      projectAt(start, ends, 0);
      projectAt(end, ends, point);
      const s = stripe * i;
      stripeLines[s] = ends[0];
      stripeLines[s + 1] = ends[1];
      stripeLines[s + 2] = ends[point];
      stripeLines[s + 3] = ends[point + 1];
      if (gpu) continue;
      faces[i].setAttribute("points", drawn);
      clips[i].setAttribute("points", drawn);
      glints[i].setAttribute("points", drawn);
      glints[i].setAttribute("opacity", fixed(flashes[i]));
      waves[i].setAttribute("x1", fixed(stripeLines[s]));
      waves[i].setAttribute("y1", fixed(stripeLines[s + 1]));
      waves[i].setAttribute("x2", fixed(stripeLines[s + 2]));
      waves[i].setAttribute("y2", fixed(stripeLines[s + 3]));
    }
    for (let i = 0; i < struts.length; i++) {
      const o = strut * i;
      rotateAt(struts[i][0], seen, 0);
      rotateAt(struts[i][1], seen, point);
      flatAt(seen, 0, ends, 0);
      flatAt(seen, point, ends, point);
      castAt(seen, 0, castPoint, 0);
      flatAt(castPoint, 0, shadowEnds, 0);
      castAt(seen, point, castPoint, 0);
      flatAt(castPoint, 0, shadowEnds, point);
      const k1 = ends[2],
        k2 = ends[point + 2];
      strutLines[o] = ends[0];
      strutLines[o + 1] = ends[1];
      strutLines[o + 2] = ends[point];
      strutLines[o + 3] = ends[point + 1];
      strutLines[o + 4] = (MIRROR.strutWidth * (k1 + k2)) / 2;
      strutLines[o + shadow] = shadowEnds[0];
      strutLines[o + shadow + 1] = shadowEnds[1];
      strutLines[o + shadow + 2] = shadowEnds[point];
      strutLines[o + shadow + 3] = shadowEnds[point + 1];
      strutLines[o + shadow + 4] = (MIRROR.strutWidth * SOLID.shadow[1] * (k1 + k2)) / 2;
      if (gpu) continue;
      lineAt(lines[i], o);
      lineAt(shadowLines[i], o + shadow);
    }
    focus[0] = focus[1] = 0;
    for (let c = 0; c < secondary.length; c++) {
      rotateAt(secondary[c], seen, point * c);
      flatAt(seen, point * c, geometry.cap, point * c);
      focus[0] += geometry.cap[point * c] / secondary.length;
      focus[1] += geometry.cap[point * c + 1] / secondary.length;
      castAt(seen, point * c, castPoint, 0);
      flatAt(castPoint, 0, geometry.capShadow, point * c);
    }
    if (gpu) {
      gpu.draw(geometry);
      return;
    }
    cap.setAttribute("points", pointsOf(geometry.cap, 0, secondary.length));
    shadowCap.setAttribute("points", pointsOf(geometry.capShadow, 0, secondary.length));
  };
  return {
    frame,
    at: (i) => (i < 0 ? focus : centres[i]),
    flash(i) {
      flashes[i] = 1;
    },
    recolour() {
      gpu?.recolour();
    },
  };
}
