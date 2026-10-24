/** Fake expo-file-system: files kept in memory by address; the test puts files there and reads what the app wrote. */
export const files = new Map<string, string>();
export const dirs = new Set<string>();

const join = (parts: unknown[]) =>
  parts
    .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
    .reduce((a, b) => `${a.replace(/\/+$/, "")}/${b.replace(/^\/+/, "")}`);

export class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get name() {
    return this.uri.split("/").pop()!;
  }
  get exists() {
    return files.has(this.uri);
  }
  create() {
    files.set(this.uri, "");
  }
  async write(text: string) {
    files.set(this.uri, text);
  }
  async text() {
    const text = files.get(this.uri);
    if (text === undefined) throw new Error(`no such file ${this.uri}`);
    return text;
  }
  delete() {
    files.delete(this.uri);
  }
}

export class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    return dirs.has(this.uri);
  }
  create() {
    dirs.add(this.uri);
  }
  list() {
    return [...files.keys()].filter((u) => u.startsWith(this.uri + "/")).map((u) => new File(u));
  }
}

export const Paths = { document: { uri: "file:///document" }, cache: { uri: "file:///cache" } };

export function resetFiles() {
  files.clear();
  dirs.clear();
}
