/** Android's `versionCode` for a release: it only has to grow, and Play refuses an upload that does not. */
export function versionCode(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!m) throw new Error(`not a semantic version: ${version}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (minor > 999 || patch > 999) throw new Error(`minor and patch must stay under 1000: ${version}`);
  return major * 1_000_000 + minor * 1_000 + patch;
}
