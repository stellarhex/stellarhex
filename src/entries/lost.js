import { byId } from "../../tools/core/dom.js";
import { initPhasing } from "../../tools/optics/phasing.js";

/* ---------- lost ---------- */

const mark = byId("lost-mark");

if (mark) initPhasing(mark);
