/** True for a path on this site: one leading slash, no backslash (browsers read `/\host` as `//host`) and no control characters. */
export function isOnSitePath(path: unknown): path is string {
  return typeof path === "string" && /^\/(?![/\\])/.test(path) && !/[\\\u0000-\u001f\u007f]/.test(path);
}
