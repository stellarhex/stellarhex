import { radians, turn, seeded } from "../core/math.js";
import { reducedMotion } from "../core/dom.js";
import { lighten, colourOf, channelsOf } from "../core/colour.js";
import { MARK_HALF } from "../core/svg.js";
import { MIRROR } from "../identity/mark.js";
import { CAMERA, HALO } from "./scene.js";
import { glHalo } from "./webgl.js";

/* ---------- halo ---------- */

const SPIKES = (() => {
  const length = new Map(),
    add = (angle, run) => {
      const a = turn(angle, 180);
      length.set(a, (length.get(a) || 0) + run);
    };
  MIRROR.centres.forEach(() => {
    for (let k = 0; k < 6; k++) add(60 * k + 30, MIRROR.segment);
  });
  MIRROR.strutAngles.forEach((angle) => add(angle + 90, 2 * MIRROR.rim));
  const most = Math.max(...length.values());
  return [...length].map(([angle, run]) => [angle, run / most]);
})();

const gaussian = (x, centre, width) => Math.exp(-(((x - centre) / width) ** 2));
const haloDensity = (offset) => {
  const bands = HALO.bands.reduce(
    (sum, [centre, width, weight]) => sum + weight * gaussian(offset, centre, width),
    HALO.floor,
  );
  return bands * (1 - HALO.gap[2] * gaussian(offset, HALO.gap[0], HALO.gap[1]));
};

export function initHalo(back, front, mark, mirror) {
  const overlay = front.cloneNode();
  overlay.removeAttribute("id");
  front.after(overlay);
  const gpu = glHalo(back, front);
  const layers = [back, front, overlay].map((canvas) => ({
      canvas,
      ctx: gpu && canvas !== overlay ? null : canvas.getContext("2d"),
    })),
    trails = layers.slice(0, 2);
  const random = seeded(11);
  const peak = Math.max(
    ...Array.from({ length: HALO.peakSamples + 1 }, (_, i) =>
      haloDensity(i / HALO.peakSamples - 0.5),
    ),
  );
  const bell = () => (random() + random() + random() - 1.5) / 1.5;
  const particles = [];
  while (particles.length < HALO.particles) {
    const offset = random() - 0.5,
      density = haloDensity(offset);
    if (random() * peak > density) continue;
    const core = Math.exp(-((offset / HALO.coreWidth) ** 2));
    particles.push({
      angle: random() * 2 * Math.PI,
      offset,
      speed:
        (HALO.drift + HALO.core * core) * (HALO.pace[0] + random() * (HALO.pace[1] - HALO.pace[0])),
      incline: radians(HALO.incline) * bell(),
      node: random() * 2 * Math.PI,
      shade: Math.min(HALO.shades - 1, Math.floor((density / peak) * HALO.shades)),
    });
  }
  gpu?.particles(particles);
  const viewCos = Math.cos(radians(HALO.view)),
    viewSin = Math.sin(radians(HALO.view));
  let size = 0,
    centre = 0,
    band = 0,
    time = 0,
    colour = "",
    groundClear = "",
    visible = false,
    running = false,
    last = 0;
  let markOrigin = [0, 0],
    markScale = 1,
    cycle = -1,
    energy = 0,
    glows = [],
    frames = 0;
  const { capture } = HALO,
    falls = capture.lifts.length - 1;
  const onMark = (from, out) => {
    out[0] = markOrigin[0] + from[0] * markScale;
    out[1] = markOrigin[1] + from[1] * markScale;
    return out;
  };

  const fit = () => {
    const width = back.getBoundingClientRect().width,
      density = Math.min(devicePixelRatio || 1, HALO.density);
    for (const { canvas, ctx } of layers) {
      canvas.width = canvas.height = Math.round(width * density);
      ctx?.setTransform(density, 0, 0, density, 0, 0);
    }
    size = width;
    const markRadius = ((mark.getBoundingClientRect().width / 2) * MIRROR.outline) / MARK_HALF;
    const inner = markRadius * HALO.inner,
      outer = width / 2 - HALO.margin - HALO.line[1];
    centre = (inner + outer) / 2;
    band = outer - inner;
    const box = back.getBoundingClientRect(),
      seen = mark.getBoundingClientRect();
    markOrigin = [seen.left + seen.width / 2 - box.left, seen.top + seen.height / 2 - box.top];
    markScale = seen.width / (2 * MARK_HALF);
  };

  const point = new Float64Array(5),
    takeoff = new Float64Array(3),
    behind = new Float64Array(3),
    landing = new Float64Array(2),
    focal = new Float64Array(2);

  const orbit = (particle, then, out) => {
    const a = particle.angle - particle.speed * (time - then);
    const r =
      (centre + particle.offset * band) *
      (1 + HALO.wave.amplitude * Math.cos(HALO.wave.crests * a - HALO.wave.speed * then));
    const across = r * Math.sin(a),
      px = r * Math.cos(a),
      py = across * Math.cos(particle.incline),
      z = across * Math.sin(particle.incline);
    const node = particle.node + HALO.precession * then,
      x = px * Math.cos(node) - py * Math.sin(node),
      y = px * Math.sin(node) + py * Math.cos(node);
    const seenY = y * viewCos - z * viewSin,
      near = y * viewSin + z * viewCos;
    const roll = radians(HALO.roll + HALO.sway * Math.sin((2 * Math.PI * then) / HALO.swayPeriod));
    const scale = 1 / (1 - near / (CAMERA.depth * size));
    out[0] = size / 2 + (x * Math.cos(roll) - seenY * Math.sin(roll)) * scale;
    out[1] = size / 2 + (x * Math.sin(roll) + seenY * Math.cos(roll)) * scale;
    out[2] = near / r;
    return out;
  };

  const at = (particle, ago) => {
    const then = time - ago,
      flight = particle.flight;
    orbit(particle, then, point);
    point[3] = 1;
    point[4] = 0;
    if (!flight || then < flight.start || then >= flight.back) return point;
    if (then >= flight.arrive) {
      point[3] = 0;
      return point;
    }
    onMark(mirror.at(flight.facet), landing);
    const lx = landing[0],
      ly = landing[1];
    if (!flight.from) {
      orbit(particle, flight.start, takeoff);
      orbit(particle, flight.start - capture.tangent, behind);
      const tangent = Math.hypot(takeoff[0] - behind[0], takeoff[1] - behind[1]) || 1,
        reach = capture.peel * Math.hypot(lx - takeoff[0], ly - takeoff[1]);
      flight.from = [takeoff[0], takeoff[1]];
      flight.ctrl = [
        takeoff[0] + ((takeoff[0] - behind[0]) / tangent) * reach,
        takeoff[1] + ((takeoff[1] - behind[1]) / tangent) * reach,
      ];
    }
    if (then < flight.land) {
      const u = (then - flight.start) / capture.fall,
        k = u * u,
        w = 1 - k,
        from = flight.from,
        ctrl = flight.ctrl;
      point[0] = w * w * from[0] + 2 * w * k * ctrl[0] + k * k * lx;
      point[1] = w * w * from[1] + 2 * w * k * ctrl[1] + k * k * ly;
      point[4] = 1 + Math.min(falls - 1, Math.floor(u * falls));
      return point;
    }
    onMark(mirror.at(-1), focal);
    const k = (then - flight.land) / capture.hop;
    point[0] = lx + (focal[0] - lx) * k;
    point[1] = ly + (focal[1] - ly) * k;
    point[4] = falls + 1;
    return point;
  };

  const choose = () => {
    const focus = onMark(mirror.at(-1), [0, 0]),
      from = cycle * capture.period,
      spread = capture.period - capture.fall - capture.back;
    const near = particles
      .filter((particle) => !particle.flight || particle.flight.back <= time)
      .map((particle) => {
        const [x, y, depth] = at(particle, 0);
        return [Math.hypot(x - focus[0], y - focus[1]), particle, depth];
      })
      .filter(([, , depth]) => depth > capture.front)
      .sort((a, b) => a[0] - b[0])
      .slice(0, capture.pool)
      .map(([, particle]) => particle);
    const around = near
      .map((particle) => {
        const [x, y] = at(particle, 0);
        return [Math.atan2(y - focus[1], x - focus[0]), particle];
      })
      .sort((a, b) => a[0] - b[0])
      .map(([, particle]) => particle);
    const bucket = around.length / capture.count;
    for (let picked = 0; picked < capture.count && around.length; picked++) {
      const particle =
          around[Math.min(around.length - 1, Math.floor((picked + Math.random()) * bucket))],
        start = from + Math.random() * spread;
      const land = start + capture.fall,
        arrive = land + capture.hop;
      particle.flight = {
        start,
        land,
        arrive,
        back: arrive + capture.back,
        facet: Math.floor(Math.random() * MIRROR.centres.length),
        from: null,
      };
    }
    gpu?.flights(particles, time);
  };

  const ages = HALO.trail - 1,
    trailBuckets = trails.length * HALO.depths * HALO.shades * ages,
    bucketCount = trailBuckets + capture.lifts.length * ages;
  const segmentEnds = new Float64Array(4 * particles.length * ages),
    bucketOf = new Uint16Array(particles.length * ages);
  const order = new Uint32Array(particles.length * ages),
    starts = new Uint32Array(bucketCount + 1),
    cursor = new Uint32Array(bucketCount);
  const heads = new Float64Array(3 * particles.length);
  const strokeBucket = (ctx, bucket) => {
    const end = starts[bucket + 1];
    if (starts[bucket] === end) return;
    ctx.beginPath();
    for (let j = starts[bucket]; j < end; j++) {
      const o = 4 * order[j];
      ctx.moveTo(segmentEnds[o], segmentEnds[o + 1]);
      ctx.lineTo(segmentEnds[o + 2], segmentEnds[o + 3]);
    }
    ctx.stroke();
  };

  const draw = (dt) => {
    time += dt;
    mirror.frame(time);
    const lap = Math.floor(time / capture.period);
    if (lap !== cycle) {
      cycle = lap;
      choose();
    }
    energy *= Math.exp(-dt / capture.decay);
    const whole = gpu || dt === 0 || frames++ % HALO.trail === 0,
      steps = whole ? ages : 1;
    let segments = 0,
      headCount = 0;
    for (const particle of particles) {
      particle.angle += dt * particle.speed;
      const flight = particle.flight;
      if (flight && flight.land > time - dt && flight.land <= time) mirror.flash(flight.facet);
      if (flight && flight.arrive > time - dt && flight.arrive <= time) energy += 1;
      if (gpu && !(flight && flight.start <= time && flight.back > time - steps * HALO.spacing))
        continue;
      at(particle, 0);
      let x0 = point[0],
        y0 = point[1],
        shown0 = point[3],
        flying0 = point[4];
      if (flying0 && flying0 <= falls) {
        heads[3 * headCount] = x0;
        heads[3 * headCount + 1] = y0;
        heads[3 * headCount++ + 2] = flying0 - 1;
      }
      for (let age = 0; age < steps; age++) {
        at(particle, whole ? (age + 1) * HALO.spacing : dt);
        const x1 = point[0],
          y1 = point[1],
          near = point[2],
          shown1 = point[3],
          flying1 = point[4];
        if (shown0 && shown1) {
          const step = Math.min(HALO.depths - 1, Math.floor(((near + 1) / 2) * HALO.depths)),
            level = Math.max(flying0, flying1);
          const trail =
            (((near > 0 ? HALO.depths : 0) + step) * HALO.shades + particle.shade) * ages + age;
          const bucket = level ? trailBuckets + (level - 1) * ages + age : gpu ? -1 : trail;
          if (bucket >= 0) {
            const o = 4 * segments;
            segmentEnds[o] = x0;
            segmentEnds[o + 1] = y0;
            segmentEnds[o + 2] = x1;
            segmentEnds[o + 3] = y1;
            bucketOf[segments++] = bucket;
          }
        }
        x0 = x1;
        y0 = y1;
        shown0 = shown1;
        flying0 = flying1;
      }
    }
    starts.fill(0);
    for (let i = 0; i < segments; i++) starts[bucketOf[i] + 1]++;
    for (let b = 0; b < bucketCount; b++) {
      starts[b + 1] += starts[b];
      cursor[b] = starts[b];
    }
    for (let i = 0; i < segments; i++) order[cursor[bucketOf[i]]++] = i;

    if (gpu) gpu.render(particles, { time, size, centre, band });
    else
      for (let layer = 0; layer < trails.length; layer++) {
        const { ctx } = trails[layer];
        if (whole) ctx.clearRect(0, 0, size, size);
        else {
          ctx.globalCompositeOperation = "destination-out";
          ctx.globalAlpha = 1 - HALO.fade ** (dt / HALO.spacing);
          ctx.fillRect(0, 0, size, size);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.strokeStyle = colour;
        ctx.lineCap = "butt";
        for (let step = 0; step < HALO.depths; step++) {
          const depth = step / (HALO.depths - 1);
          ctx.lineWidth = HALO.line[0] + (HALO.line[1] - HALO.line[0]) * depth;
          for (let shade = 0; shade < HALO.shades; shade++)
            for (let age = 0; age < steps; age++) {
              ctx.globalAlpha =
                HALO.fade ** age *
                (HALO.far + (1 - HALO.far) * depth) *
                ((shade + 1) / HALO.shades);
              strokeBucket(ctx, ((layer * HALO.depths + step) * HALO.shades + shade) * ages + age);
            }
        }
        ctx.globalAlpha = 1;
      }
    if (gpu) layers[2].ctx.clearRect(0, 0, size, size);
    for (let level = 0; level < capture.lifts.length; level++) {
      const { ctx } = gpu ? layers[2] : trails[1];
      ctx.strokeStyle = glows[level];
      ctx.lineWidth = capture.width[level === falls ? 1 : 0];
      for (let age = 0; age < steps; age++) {
        ctx.globalAlpha = HALO.fade ** age;
        strokeBucket(ctx, trailBuckets + level * ages + age);
      }
      ctx.globalAlpha = 1;
    }
    const { ctx } = layers[2];
    if (!gpu) ctx.clearRect(0, 0, size, size);
    ctx.globalAlpha = capture.headAlpha;
    for (let i = 0; i < headCount; i++) {
      ctx.fillStyle = glows[heads[3 * i + 2] + 1];
      ctx.beginPath();
      ctx.arc(heads[3 * i], heads[3 * i + 1], capture.head, 0, 2 * Math.PI);
      ctx.fill();
    }
    const glow = Math.min(1, energy / capture.full);
    if (glow > 0) {
      onMark(mirror.at(-1), focal);
      const fx = focal[0],
        fy = focal[1],
        radius = capture.star * (0.5 + 0.5 * glow),
        star = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius);
      star.addColorStop(0, "white");
      star.addColorStop(0.3, colour);
      star.addColorStop(1, groundClear);
      ctx.globalAlpha = glow;
      ctx.fillStyle = star;
      ctx.fillRect(fx - radius, fy - radius, 2 * radius, 2 * radius);
      const reach = capture.star * capture.rays[0] * glow,
        width = capture.rays[1];
      for (const spike of SPIKES)
        for (let side = 0; side <= 180; side += 180) {
          const weight = spike[1],
            heading = radians(spike[0] + side),
            dx = reach * weight * Math.cos(heading),
            dy = reach * weight * Math.sin(heading);
          const ray = ctx.createLinearGradient(fx, fy, fx + dx, fy + dy);
          ray.addColorStop(0, colour);
          ray.addColorStop(1, groundClear);
          ctx.strokeStyle = ray;
          ctx.lineWidth = width * weight;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + dx, fy + dy);
          ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
  };

  const frame = (now) => {
    if (!visible) {
      running = false;
      return;
    }
    if (now - last >= 1000 / HALO.rate - HALO.slack) {
      draw(Math.min(HALO.longest, (now - last) / 1000));
      last = now;
    }
    requestAnimationFrame(frame);
  };
  const start = () => {
    if (running || !visible || reducedMotion) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  new ResizeObserver(() => {
    fit();
    draw(0);
  }).observe(back);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(back);

  return {
    recolour() {
      const ground = channelsOf("var(--mark-cut)", mark).join(", ");
      colour = colourOf("var(--brand)", mark);
      gpu?.colour(channelsOf("var(--brand)", mark));
      groundClear = `rgba(${ground}, 0)`;
      front.style.background = `linear-gradient(rgba(${ground}, ${HALO.veil}), ${groundClear} 50%)`;
      glows = capture.lifts.map((lift) => colourOf(lighten(colour, lift), mark));
      if (size) draw(0);
    },
  };
}
