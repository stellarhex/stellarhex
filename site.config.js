export const BASE_PATH = process.env.BASE ?? "/";

export const SITE_URL = (process.env.SITE_URL ?? "https://stellarhex.com/").replace(/\/?$/, "/");

export const ALLOW_INDEXING = process.env.ALLOW_INDEXING === "true";

export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION ?? "";
