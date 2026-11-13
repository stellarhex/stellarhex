import { relative, sep } from "node:path";

export const posixRelative = (from, to) => relative(from, to).split(sep).join("/");

export const DIST = "dist";
