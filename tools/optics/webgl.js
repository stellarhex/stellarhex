import { radians, once } from "../core/math.js";
import { RELATIVE, linear, channelsOf } from "../core/colour.js";
import { MARK_HALF } from "../core/svg.js";
import { MIRROR } from "../identity/mark.js";
import { CAMERA, MIRROR_LAYOUT, SOLID, HALO } from "./scene.js";

/* ---------- webgl ---------- */

const GL_CONTEXT = {
  alpha: true,
  premultipliedAlpha: true,
  depth: false,
  failIfMajorPerformanceCaveat: true,
};
const GL_SOFTWARE = /swiftshader|llvmpipe|softpipe|software/i;

const glAllowed = once(() => {
  const trial = document.createElement("canvas").getContext("webgl2", GL_CONTEXT),
    info = trial?.getExtension("WEBGL_debug_renderer_info");
  const software = GL_SOFTWARE.test(info ? trial.getParameter(info.UNMASKED_RENDERER_WEBGL) : "");
  trial?.getExtension("WEBGL_lose_context")?.loseContext();
  return Boolean(trial) && !software;
});

function glProgram(gl, vertex, fragment) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/* ---------- halo ---------- */

const GL_HALO_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in float offset;
layout(location = 1) in float speed;
layout(location = 2) in float incline;
layout(location = 3) in float node;
layout(location = 4) in float shade;
layout(location = 5) in float angle;
layout(location = 6) in vec2 capture;

uniform float uSize, uCentre, uBand, uDensity, uDepth, uSince, uSpacing, uFade, uFar, uDepths, uShades, uFront, uSwayRate;
uniform vec2 uView, uLine, uPrecession;
uniform vec3 uRoll;
uniform vec4 uWave;
uniform int uAges;

out float vAlpha;
out float vAcross;
out float vHalf;

const vec2 CORNERS[6] = vec2[6](vec2(0, -1), vec2(1, -1), vec2(0, 1), vec2(0, 1), vec2(1, -1), vec2(1, 1));

vec2 spin(vec2 p, float a){
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec3 orbit(float ago){
  float a = angle - speed * ago;
  float r = (uCentre + offset * uBand) * (1.0 + uWave.x * cos(uWave.y * a - uWave.z + uWave.w * ago));
  float across = r * sin(a);
  vec2 p = spin(vec2(r * cos(a), across * cos(incline)), node + uPrecession.x - uPrecession.y * ago);
  float z = across * sin(incline), near = p.y * uView.y + z * uView.x;
  vec2 seen = spin(vec2(p.x, p.y * uView.x - z * uView.y), uRoll.x + uRoll.y * sin(uRoll.z - uSwayRate * ago));
  return vec3(uSize * 0.5 + seen / (1.0 - near / uDepth), near / r);
}

bool captured(float then){
  return then >= capture.x && then < capture.y;
}

void main(){
  int age = gl_InstanceID % uAges;
  float ago = float(age) * uSpacing;
  vec3 a = orbit(ago), b = orbit(ago + uSpacing);
  vec2 run = b.xy - a.xy;
  float span = length(run);
  if (captured(uSince - ago) || captured(uSince - ago - uSpacing) || (b.z > 0.0) != (uFront > 0.5) || span < 1e-4){
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float depth = min(uDepths - 1.0, floor((b.z + 1.0) / 2.0 * uDepths)) / (uDepths - 1.0);
  vHalf = (uLine.x + (uLine.y - uLine.x) * depth) * uDensity / 2.0;
  vAlpha = pow(uFade, float(age)) * (uFar + (1.0 - uFar) * depth) * (shade + 1.0) / uShades;
  vec2 corner = CORNERS[gl_VertexID];
  vAcross = corner.y * (vHalf + 1.0);
  vec2 at = mix(a.xy, b.xy, corner.x) + vec2(-run.y, run.x) / span * vAcross / uDensity;
  gl_Position = vec4(at.x / uSize * 2.0 - 1.0, 1.0 - at.y / uSize * 2.0, 0.0, 1.0);
}`;

const GL_HALO_FRAGMENT = `#version 300 es
precision highp float;

uniform vec3 uColour;

in float vAlpha;
in float vAcross;
in float vHalf;

out vec4 colour;

void main(){
  float d = abs(vAcross), cover = max(0.0, min(d + 0.5, vHalf) - max(d - 0.5, -vHalf));
  colour = vec4(uColour, 1.0) * vAlpha * cover;
}`;

const GL_HALO_ATTRIBUTES = [
  ["shape", 0, 1, 4, 0],
  ["shape", 1, 1, 4, 1],
  ["shape", 2, 1, 4, 2],
  ["shape", 3, 1, 4, 3],
  ["shade", 4, 1, 1, 0],
  ["angle", 5, 1, 1, 0],
  ["capture", 6, 2, 2, 0],
];
const GL_HALO_UNIFORMS = [
  "uSize",
  "uCentre",
  "uBand",
  "uDensity",
  "uDepth",
  "uSince",
  "uSpacing",
  "uFade",
  "uFar",
  "uDepths",
  "uShades",
  "uFront",
  "uSwayRate",
  "uView",
  "uLine",
  "uPrecession",
  "uRoll",
  "uWave",
  "uAges",
  "uColour",
];
const GL_HALO_CONTEXT = { ...GL_CONTEXT, antialias: false, stencil: false };
const GL_NO_CAPTURE = -1e6;

function glHaloLayer(canvas, data, ages, front) {
  if (!canvas.getContext("webgl2", GL_HALO_CONTEXT)) return null;
  let gl,
    uniforms,
    buffers,
    vao,
    colour = [0, 0, 0];
  const sizes = {};
  const upload = (...names) => {
    for (const name of names.length ? names : Object.keys(buffers)) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
      if (sizes[name] === data[name].byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data[name]);
      else {
        gl.bufferData(gl.ARRAY_BUFFER, data[name], gl.DYNAMIC_DRAW);
        sizes[name] = data[name].byteLength;
      }
    }
  };
  const build = () => {
    gl = canvas.getContext("webgl2", GL_HALO_CONTEXT);
    const program = glProgram(gl, GL_HALO_VERTEX, GL_HALO_FRAGMENT),
      u = {};
    gl.useProgram(program);
    for (const name of GL_HALO_UNIFORMS) u[name] = gl.getUniformLocation(program, name);
    uniforms = u;
    gl.uniform1f(u.uSpacing, HALO.spacing);
    gl.uniform1f(u.uFade, HALO.fade);
    gl.uniform1f(u.uFar, HALO.far);
    gl.uniform1f(u.uDepths, HALO.depths);
    gl.uniform1f(u.uShades, HALO.shades);
    gl.uniform1f(u.uFront, front);
    gl.uniform1f(u.uSwayRate, (2 * Math.PI) / HALO.swayPeriod);
    gl.uniform2f(u.uView, Math.cos(radians(HALO.view)), Math.sin(radians(HALO.view)));
    gl.uniform2f(u.uLine, ...HALO.line);
    gl.uniform1i(u.uAges, ages);
    gl.uniform3f(u.uColour, ...colour);
    for (const name in sizes) delete sizes[name];
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buffers = {};
    for (const [name, location, size, stride, at] of GL_HALO_ATTRIBUTES) {
      buffers[name] ??= gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 4 * stride, 4 * at);
      gl.vertexAttribDivisor(location, ages);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    upload();
  };
  canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
  canvas.addEventListener("webglcontextrestored", build);
  build();

  return {
    upload,
    colour(rgb) {
      colour = rgb;
      if (!gl.isContextLost()) gl.uniform3f(uniforms.uColour, ...rgb);
    },
    render({ time, since, size, centre, band }) {
      if (gl.isContextLost()) return;
      const turn = 2 * Math.PI,
        u = uniforms;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!size) return;
      upload("angle");
      gl.uniform1f(u.uSize, size);
      gl.uniform1f(u.uCentre, centre);
      gl.uniform1f(u.uBand, band);
      gl.uniform1f(u.uDensity, canvas.width / size);
      gl.uniform1f(u.uDepth, CAMERA.depth * size);
      gl.uniform1f(u.uSince, since);
      gl.uniform2f(u.uPrecession, (HALO.precession * time) % turn, HALO.precession);
      gl.uniform3f(
        u.uRoll,
        radians(HALO.roll),
        radians(HALO.sway),
        ((turn * time) / HALO.swayPeriod) % turn,
      );
      gl.uniform4f(
        u.uWave,
        HALO.wave.amplitude,
        HALO.wave.crests,
        (HALO.wave.speed * time) % turn,
        HALO.wave.speed,
      );
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.angle.length * ages);
    },
  };
}

export function glHalo(back, front) {
  if (!glAllowed()) return null;
  const trial = document.createElement("canvas").getContext("webgl2", GL_HALO_CONTEXT),
    works = trial && glProgram(trial, GL_HALO_VERTEX, GL_HALO_FRAGMENT);
  trial?.getExtension("WEBGL_lose_context")?.loseContext();
  if (!works) return null;

  const ages = HALO.trail - 1,
    turn = 2 * Math.PI;
  const data = {
    shape: new Float32Array(0),
    shade: new Float32Array(0),
    angle: new Float32Array(0),
    capture: new Float32Array(0),
  };
  const rear = glHaloLayer(back, data, ages, 0);
  if (!rear) return null;
  const layers = [rear, glHaloLayer(front, data, ages, 1)].filter(Boolean);
  let base = 0;

  return {
    particles(list) {
      data.shape = Float32Array.from(
        list.flatMap(({ offset, speed, incline, node }) => [offset, speed, incline, node]),
      );
      data.shade = Float32Array.from(list, ({ shade }) => shade);
      data.angle = new Float32Array(list.length);
      data.capture = new Float32Array(2 * list.length).fill(GL_NO_CAPTURE);
      layers.forEach((layer) => layer.upload());
    },
    flights(list, now) {
      base = now;
      list.forEach(({ flight }, i) =>
        data.capture.set(
          flight ? [flight.start - now, flight.back - now] : [GL_NO_CAPTURE, GL_NO_CAPTURE],
          2 * i,
        ),
      );
      layers.forEach((layer) => layer.upload("capture"));
    },
    colour(channels) {
      layers.forEach((layer) => layer.colour(channels.map((channel) => channel / 255)));
    },
    render(list, { time, size, centre, band }) {
      for (let i = 0; i < list.length; i++) data.angle[i] = list[i].angle % turn;
      layers.forEach((layer) => layer.render({ time, since: time - base, size, centre, band }));
    },
  };
}

/* ---------- mirror ---------- */

const GL_MIRROR_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 position;
layout(location = 1) in vec3 paint;
layout(location = 2) in vec4 stripe;

uniform float uHalf;
uniform vec3 uBrand;
uniform vec3 uCut;
uniform vec2 uStripe;

out vec2 vAt;
flat out int vKind;
flat out vec4 vColour;
flat out vec4 vStripe;
flat out vec3 vTrough, vMiddle, vCrest;

vec3 shade(float lift){
  float L = uBrand.x + lift, a = uBrand.y, b = uBrand.z;
  float l = L + 0.3963377774 * a + 0.2158037573 * b, m = L - 0.1055613458 * a - 0.0638541728 * b, s = L - 0.0894841775 * a - 1.2914855480 * b;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  vec3 linear = clamp(vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0);
  return mix(12.92 * linear, 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linear));
}

void main(){
  vAt = position;
  vKind = int(paint.x + 0.5);
  vStripe = stripe;
  if (vKind == 1){
    vTrough = shade(uStripe.x);
    vMiddle = shade((uStripe.x + uStripe.y) / 2.0);
    vCrest = shade(uStripe.y);
  }
  vec3 c = vKind == 0 ? shade(paint.y) : vKind == 2 ? uCut : vec3(0.0);
  vColour = vec4(c, 1.0) * paint.z;
  gl_Position = vec4(position.x / uHalf, -position.y / uHalf, 0.0, 1.0);
}`;

const GL_MIRROR_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vAt;
flat in int vKind;
flat in vec4 vColour;
flat in vec4 vStripe;
flat in vec3 vTrough, vMiddle, vCrest;

out vec4 colour;

void main(){
  if (vKind != 1){
    colour = vColour;
    return;
  }
  vec2 run = vStripe.zw - vStripe.xy;
  float span = dot(run, run), u = span > 1e-9 ? 4.0 * fract(dot(vAt - vStripe.xy, run) / span) : 4.0;
  vec3 c = u < 1.0 ? mix(vTrough, vMiddle, u) : u < 2.0 ? mix(vMiddle, vCrest, u - 1.0)
         : u < 3.0 ? mix(vCrest, vMiddle, u - 2.0) : mix(vMiddle, vTrough, u - 3.0);
  colour = vec4(c, 1.0);
}`;

const GL_PAINT = { flat: 0, stripe: 1, cut: 2, shadow: 3 };
const GL_MIRROR_STRIDE = 9;
const GL_VERTICES = { quad: 6, hexagon: 12, ring: 36 };
const GL_NO_STRIPE = [0, 0, 0, 0];
const GL_SVG_STROKE = 1;
const GL_GLINT_FLOOR = 0.005;
const GL_OVERSAMPLE = [2, 3];

function glOklab(channels) {
  const [lr, lg, lb] = channels.map(linear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function glOutset(polygon, distance, out) {
  const n = polygon.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const turn = Math.sign(area) || 1;
  for (let i = 0; i < n; i++) {
    const before = polygon[(i + n - 1) % n],
      point = polygon[i],
      after = polygon[(i + 1) % n];
    const px = before[0],
      py = before[1],
      x = point[0],
      y = point[1],
      qx = after[0],
      qy = after[1];
    const la = Math.sqrt((x - px) ** 2 + (y - py) ** 2) || 1,
      lb = Math.sqrt((qx - x) ** 2 + (qy - y) ** 2) || 1;
    const ax = (turn * (y - py)) / la,
      ay = (-turn * (x - px)) / la,
      bx = (turn * (qy - y)) / lb,
      by = (-turn * (qx - x)) / lb;
    const k = distance / (1 + ax * bx + ay * by);
    out[i][0] = x + (ax + bx) * k;
    out[i][1] = y + (ay + by) * k;
  }
  return out;
}

export function glMirror(holder, svg) {
  if (!glAllowed() || !RELATIVE) return null;
  const {
    point,
    corners: cornerCount,
    face,
    wall,
    stripe: stripeSize,
    strut,
    shadow,
  } = MIRROR_LAYOUT;
  const canvas = document.createElement("canvas"),
    context = { ...GL_CONTEXT, antialias: true, stencil: true };
  canvas.setAttribute("class", svg.getAttribute("class"));
  canvas.setAttribute("aria-hidden", "true");
  const segments = MIRROR.centres.length,
    struts = MIRROR.strutAngles.length,
    { quad, hexagon: hexagonVertices, ring: ringVertices } = GL_VERTICES;
  const capacity =
    segments * (cornerCount * quad + 2 * hexagonVertices + ringVertices) +
    2 * (struts * quad + hexagonVertices);
  const vertices = new Float32Array(capacity * GL_MIRROR_STRIDE),
    stripeLine = new Float32Array(stripeSize),
    paint = new Float32Array(3);
  const [corners, outer, inner] = [0, 1, 2].map(() =>
    Array.from({ length: cornerCount }, () => new Float64Array(2)),
  );
  let gl,
    uniforms,
    buffer,
    vao,
    geometry = null,
    count = 0,
    stripe = GL_NO_STRIPE;

  const use = (kind, lift = 0, alpha = 1, line = GL_NO_STRIPE) => {
    paint[0] = kind;
    paint[1] = lift;
    paint[2] = alpha;
    stripe = line;
  };
  const put = (x, y) => {
    const o = GL_MIRROR_STRIDE * count++;
    vertices[o] = x;
    vertices[o + 1] = y;
    vertices.set(paint, o + 2);
    vertices.set(stripe, o + 5);
  };
  const triangle = (a, b, c) => {
    put(a[0], a[1]);
    put(b[0], b[1]);
    put(c[0], c[1]);
  };
  const fan = (polygon) => {
    for (let k = 1; k < polygon.length - 1; k++) triangle(polygon[0], polygon[k], polygon[k + 1]);
  };
  const fanAt = (buffer, offset, size) => {
    for (let k = 1; k < size - 1; k++) {
      put(buffer[offset], buffer[offset + 1]);
      put(buffer[offset + point * k], buffer[offset + point * k + 1]);
      put(buffer[offset + point * (k + 1)], buffer[offset + point * (k + 1) + 1]);
    }
  };
  const cornersAt = (buffer, offset) => {
    for (let c = 0; c < cornerCount; c++) {
      corners[c][0] = buffer[offset + point * c];
      corners[c][1] = buffer[offset + point * c + 1];
    }
    return corners;
  };
  const bar = (buffer, o) => {
    const x1 = buffer[o],
      y1 = buffer[o + 1],
      x2 = buffer[o + 2],
      y2 = buffer[o + 3],
      width = buffer[o + 4];
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1,
      nx = ((-(y2 - y1) / length) * width) / 2,
      ny = (((x2 - x1) / length) * width) / 2;
    put(x1 + nx, y1 + ny);
    put(x2 + nx, y2 + ny);
    put(x2 - nx, y2 - ny);
    put(x1 + nx, y1 + ny);
    put(x2 - nx, y2 - ny);
    put(x1 - nx, y1 - ny);
  };
  const ring = (polygon, width) => {
    glOutset(polygon, width / 2, outer);
    glOutset(polygon, -width / 2, inner);
    for (let k = 0; k < polygon.length; k++) {
      const next = (k + 1) % polygon.length;
      triangle(outer[k], outer[next], inner[next]);
      triangle(outer[k], inner[next], inner[k]);
    }
  };

  const build = () => {
    gl = canvas.getContext("webgl2", context);
    const program = gl && glProgram(gl, GL_MIRROR_VERTEX, GL_MIRROR_FRAGMENT);
    if (!program) return false;
    gl.useProgram(program);
    uniforms = Object.fromEntries(
      ["uHalf", "uBrand", "uCut", "uStripe"].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    );
    gl.uniform1f(uniforms.uHalf, MARK_HALF);
    gl.uniform2f(uniforms.uStripe, SOLID.wave.trough, SOLID.wave.crest);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
    for (const [location, size, at] of [
      [0, 2, 0],
      [1, 3, 2],
      [2, 4, 5],
    ]) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 4 * GL_MIRROR_STRIDE, 4 * at);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  };
  if (!build()) return null;

  const fit = () => {
    const side = Math.max(
      1,
      Math.round(
        holder.clientWidth *
          Math.min(GL_OVERSAMPLE[1], Math.max(GL_OVERSAMPLE[0], devicePixelRatio || 1)),
      ),
    );
    if (canvas.width !== side) canvas.width = canvas.height = side;
  };
  fit();
  svg.replaceWith(canvas);

  const draw = (next) => {
    geometry = next;
    if (gl.isContextLost()) return;
    const {
      faces,
      stripes,
      flashes,
      wallVisible,
      wallLift,
      wallQuads,
      strutLines,
      cap,
      capShadow,
    } = next;
    const faceCount = flashes.length,
      strutCount = strutLines.length / strut;
    count = 0;
    for (let w = 0; w < wallVisible.length; w++)
      if (wallVisible[w]) {
        use(GL_PAINT.flat, wallLift[w]);
        fanAt(wallQuads, wall * w, wall / point);
      }
    const facesFrom = count;
    for (let i = 0; i < faceCount; i++) {
      for (let m = 0; m < stripeSize; m++) stripeLine[m] = stripes[stripeSize * i + m];
      use(GL_PAINT.stripe, 0, 1, stripeLine);
      fanAt(faces, face * i, cornerCount);
    }
    const facesTo = count;
    use(GL_PAINT.flat, SOLID.bevel[1]);
    for (let i = 0; i < faceCount; i++) ring(cornersAt(faces, face * i), SOLID.bevel[0]);
    for (let i = 0; i < faceCount; i++)
      if (flashes[i] >= GL_GLINT_FLOOR) {
        use(GL_PAINT.flat, SOLID.flash.lift, flashes[i]);
        fanAt(faces, face * i, cornerCount);
      }
    const shadowsFrom = count;
    use(GL_PAINT.shadow, 0, SOLID.shadow[0]);
    for (let i = 0; i < strutCount; i++) bar(strutLines, strut * i + shadow);
    fan(glOutset(cornersAt(capShadow, 0), GL_SVG_STROKE / 2, outer));
    const solidFrom = count;
    use(GL_PAINT.cut);
    for (let i = 0; i < strutCount; i++) bar(strutLines, strut * i);
    fanAt(cap, 0, cornerCount);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices, 0, count * GL_MIRROR_STRIDE);
    gl.drawArrays(gl.TRIANGLES, 0, shadowsFrom);
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.drawArrays(gl.TRIANGLES, facesFrom, facesTo - facesFrom);
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.EQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.drawArrays(gl.TRIANGLES, shadowsFrom, solidFrom - shadowsFrom);
    gl.disable(gl.STENCIL_TEST);
    gl.drawArrays(gl.TRIANGLES, solidFrom, count - solidFrom);
  };

  const recolour = () => {
    gl.uniform3f(uniforms.uBrand, ...glOklab(channelsOf("var(--brand)", holder)));
    gl.uniform3f(
      uniforms.uCut,
      ...channelsOf("var(--mark-cut)", holder).map((channel) => channel / 255),
    );
    if (geometry) draw(geometry);
  };
  recolour();
  new ResizeObserver(() => {
    fit();
    if (geometry) draw(geometry);
  }).observe(holder);
  canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => {
    if (build()) recolour();
  });

  return { draw, recolour };
}
