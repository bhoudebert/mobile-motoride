/** Fake expo-file-system: files kept in memory by address; the test puts files there and reads what the app wrote. */
export const files = new Map<string, string>();
export const dirs = new Set<string>();
export const picked = { dir: "file:///phone/Download", cancel: false };

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
  /** The folder the rider "picks": a test sets `picked.dir`, or `picked.cancel`. */
  static async pickDirectoryAsync(): Promise<Directory> {
    if (picked.cancel) throw new Error("The user cancelled the directory picker");
    return new Directory(picked.dir);
  }
  createFile(name: string, _mimeType: string | null) {
    const f = new File(this, name);
    f.create();
    return f;
  }
  list() {
    return [...files.keys()].filter((u) => u.startsWith(this.uri + "/")).map((u) => new File(u));
  }
}

export const Paths = { document: { uri: "file:///document" }, cache: { uri: "file:///cache" } };

export function resetFiles() {
  picked.dir = "file:///phone/Download";
  picked.cancel = false;
  files.clear();
  dirs.clear();
}
