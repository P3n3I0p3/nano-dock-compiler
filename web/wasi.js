// Kleine WASI-Laufzeit (wasi_snapshot_preview1) mit Dateisystem im Arbeitsspeicher.
// Gerade genug, damit clang, ld.lld und die llvm-Werkzeuge aus llvm.wasm im Browser laufen.
// Läuft im Browser (Web Worker) und unter Node.js (für den Test in GitHub Actions).
//
// Dateisystem: ein Baum aus Ordnern ({ dir: Map }) und Dateien ({ data, size }).
// Jeder Knoten hat eine eigene Nummer (ino); clang erkennt Dateien daran wieder.

const E = { SUCCESS: 0, BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54, NOTEMPTY: 55 };
const FILETYPE = { CHAR: 2, DIR: 3, FILE: 4 };
const ALL_RIGHTS = 0xffffffffffffffffn;
const OFLAGS = { CREAT: 1, DIRECTORY: 2, EXCL: 4, TRUNC: 8 };
const FDFLAGS_APPEND = 1;

let nextIno = 1;
const now = () => BigInt(Date.now()) * 1000000n;

export function makeDir() { return { ino: nextIno++, mtime: now(), dir: new Map() }; }
export function makeFile(data = new Uint8Array(0)) {
  return { ino: nextIno++, mtime: now(), data, size: data.length };
}

export class ExitError extends Error {
  constructor(code) { super("exit " + code); this.code = code; }
}

// --- Hilfsfunktionen für das Dateisystem (auch von außen nutzbar) ---

function splitPath(path) { return path.split("/").filter((p) => p && p !== "."); }

// Knoten zu einem Pfad suchen; gibt [Knoten, Fehler] zurück
export function lookup(root, path, start = root) {
  const stack = path.startsWith("/") ? [root] : [start];
  for (const part of splitPath(path)) {
    const cur = stack[stack.length - 1];
    if (part === "..") { if (stack.length > 1) stack.pop(); continue; }
    if (!cur.dir) return [null, E.NOTDIR];
    const next = cur.dir.get(part);
    if (!next) return [null, E.NOENT];
    stack.push(next);
  }
  return [stack[stack.length - 1], E.SUCCESS];
}

// Elternordner und Dateiname zu einem Pfad
function parentOf(root, path, start) {
  const parts = splitPath(path);
  const name = parts.pop();
  if (!name || name === "..") return [null, null, E.INVAL];
  const [parent, err] = lookup(root, (path.startsWith("/") ? "/" : "") + parts.join("/"), start);
  if (err) return [null, null, err];
  if (!parent.dir) return [null, null, E.NOTDIR];
  return [parent, name, E.SUCCESS];
}

export function mkdirp(root, path) {
  let cur = root;
  for (const part of splitPath(path)) {
    let next = cur.dir.get(part);
    if (!next) { next = makeDir(); cur.dir.set(part, next); }
    cur = next;
  }
  return cur;
}

export function writeFile(root, path, data) {
  const parts = splitPath(path);
  const name = parts.pop();
  const dir = mkdirp(root, parts.join("/"));
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  dir.dir.set(name, makeFile(bytes));
}

export function readFile(root, path) {
  const [node, err] = lookup(root, path);
  if (err || !node.data) return null;
  return node.data.subarray(0, node.size);
}

// Datei vergrößern, ohne bei jedem Schreiben neu zu kopieren
function ensureCapacity(file, size) {
  if (size <= file.data.length) return;
  const grown = new Uint8Array(Math.max(size, file.data.length * 2, 4096));
  grown.set(file.data.subarray(0, file.size));
  file.data = grown;
}

// --- Die eigentliche WASI-Schnittstelle ---

export class WASI {
  // root: Wurzelordner, args: Liste der Argumente, env: Objekt mit Umgebungsvariablen
  constructor({ root, args, env = {} }) {
    this.root = root;
    this.args = args;
    this.env = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    this.stdout = [];
    this.stderr = [];
    // 0–2: Standardein- und -ausgabe, 3: der Wurzelordner "/" als einziger freigegebener Ordner
    this.fds = new Map([[0, { std: 0 }], [1, { std: 1 }], [2, { std: 2 }], [3, { node: root, pos: 0, preopen: "/" }]]);
    this.nextFd = 4;
    this.memory = null;
  }

  // Programm ausführen; gibt den Rückgabewert (exit code) zurück
  run(instance) {
    this.memory = instance.exports.memory;
    try {
      instance.exports._start();
      return 0;
    } catch (e) {
      if (e instanceof ExitError) return e.code;
      throw e;
    }
  }

  output(which) {
    const parts = which === 1 ? this.stdout : this.stderr;
    let len = 0;
    for (const p of parts) len += p.length;
    const all = new Uint8Array(len);
    let off = 0;
    for (const p of parts) { all.set(p, off); off += p.length; }
    return all;
  }

  // Import-Objekt für WebAssembly.instantiate; nicht umgesetzte Funktionen melden ENOSYS
  imports(module) {
    const impl = this.functions();
    const ns = {};
    for (const imp of WebAssembly.Module.imports(module)) {
      if (imp.module !== "wasi_snapshot_preview1" || imp.kind !== "function") continue;
      ns[imp.name] = impl[imp.name] || (() => E.NOSYS);
    }
    return { wasi_snapshot_preview1: ns };
  }

  functions() {
    const mem = () => new DataView(this.memory.buffer);
    const bytes = () => new Uint8Array(this.memory.buffer);
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    const str = (ptr, len) => dec.decode(bytes().subarray(ptr, ptr + len));
    const fds = this.fds;
    const fdNode = (fd) => fds.get(fd);

    const writeStrings = (list, ptrs, buf) => {
      const v = mem(), b = bytes();
      for (const s of list) {
        v.setUint32(ptrs, buf, true); ptrs += 4;
        const e = enc.encode(s + "\0");
        b.set(e, buf); buf += e.length;
      }
      return E.SUCCESS;
    };
    const sizes = (list, countPtr, sizePtr) => {
      const v = mem();
      v.setUint32(countPtr, list.length, true);
      v.setUint32(sizePtr, list.reduce((n, s) => n + enc.encode(s).length + 1, 0), true);
      return E.SUCCESS;
    };
    const filestat = (node, ptr) => {
      const v = mem();
      for (let i = 0; i < 64; i += 8) v.setBigUint64(ptr + i, 0n, true);
      v.setBigUint64(ptr, 1n, true);                                   // dev
      v.setBigUint64(ptr + 8, BigInt(node.ino), true);                 // ino
      v.setUint8(ptr + 16, node.dir ? FILETYPE.DIR : FILETYPE.FILE);   // filetype
      v.setBigUint64(ptr + 24, 1n, true);                              // nlink
      v.setBigUint64(ptr + 32, BigInt(node.dir ? 0 : node.size), true);
      v.setBigUint64(ptr + 40, node.mtime, true);
      v.setBigUint64(ptr + 48, node.mtime, true);
      v.setBigUint64(ptr + 56, node.mtime, true);
      return E.SUCCESS;
    };
    // Ein- und Ausgabe über iovec-Listen
    const iovecs = (ptr, count) => {
      const v = mem(), list = [];
      for (let i = 0; i < count; i++) list.push([v.getUint32(ptr + i * 8, true), v.getUint32(ptr + i * 8 + 4, true)]);
      return list;
    };
    const readAt = (file, pos, iovs) => {
      const b = bytes();
      let total = 0;
      for (const [p, len] of iovs) {
        const n = Math.max(0, Math.min(len, file.size - pos));
        b.set(file.data.subarray(pos, pos + n), p);
        pos += n; total += n;
        if (n < len) break;
      }
      return total;
    };
    const writeAt = (file, pos, iovs) => {
      const b = bytes();
      let total = 0;
      for (const [p, len] of iovs) {
        ensureCapacity(file, pos + len);
        file.data.set(b.subarray(p, p + len), pos);
        pos += len; total += len;
        if (pos > file.size) file.size = pos;
      }
      file.mtime = now();
      return total;
    };

    return {
      args_get: (argv, buf) => writeStrings(this.args, argv, buf),
      args_sizes_get: (c, s) => sizes(this.args, c, s),
      environ_get: (env, buf) => writeStrings(this.env, env, buf),
      environ_sizes_get: (c, s) => sizes(this.env, c, s),

      clock_res_get: (id, ptr) => { mem().setBigUint64(ptr, 1000n, true); return E.SUCCESS; },
      clock_time_get: (id, precision, ptr) => {
        const t = id === 0 ? now() : BigInt(Math.round(performance.now() * 1e6));
        mem().setBigUint64(ptr, t, true);
        return E.SUCCESS;
      },
      random_get: (ptr, len) => {
        const b = bytes();
        for (let off = 0; off < len; off += 65536) crypto.getRandomValues(b.subarray(ptr + off, ptr + Math.min(len, off + 65536)));
        return E.SUCCESS;
      },
      proc_exit: (code) => { throw new ExitError(code); },
      sched_yield: () => E.SUCCESS,

      fd_prestat_get: (fd, ptr) => {
        const f = fdNode(fd);
        if (!f || !f.preopen) return E.BADF;
        const v = mem();
        v.setUint8(ptr, 0);
        v.setUint32(ptr + 4, enc.encode(f.preopen).length, true);
        return E.SUCCESS;
      },
      fd_prestat_dir_name: (fd, ptr, len) => {
        const f = fdNode(fd);
        if (!f || !f.preopen) return E.BADF;
        bytes().set(enc.encode(f.preopen).subarray(0, len), ptr);
        return E.SUCCESS;
      },
      fd_fdstat_get: (fd, ptr) => {
        const f = fdNode(fd);
        if (!f) return E.BADF;
        const v = mem();
        // Standardausgabe als Zeichengerät mit Seek-Recht: so gilt sie nicht als Terminal (keine Farben)
        v.setUint8(ptr, f.std !== undefined ? FILETYPE.CHAR : f.node.dir ? FILETYPE.DIR : FILETYPE.FILE);
        v.setUint16(ptr + 2, f.append ? FDFLAGS_APPEND : 0, true);
        v.setBigUint64(ptr + 8, ALL_RIGHTS, true);
        v.setBigUint64(ptr + 16, ALL_RIGHTS, true);
        return E.SUCCESS;
      },
      fd_fdstat_set_flags: () => E.SUCCESS,
      fd_filestat_get: (fd, ptr) => {
        const f = fdNode(fd);
        if (!f) return E.BADF;
        if (f.std !== undefined) {
          const v = mem();
          for (let i = 0; i < 64; i += 8) v.setBigUint64(ptr + i, 0n, true);
          v.setUint8(ptr + 16, FILETYPE.CHAR);
          return E.SUCCESS;
        }
        return filestat(f.node, ptr);
      },
      fd_filestat_set_size: (fd, size) => {
        const f = fdNode(fd);
        if (!f || !f.node || f.node.dir) return E.BADF;
        const n = Number(size);
        ensureCapacity(f.node, n);
        if (n > f.node.size) f.node.data.fill(0, f.node.size, n);
        f.node.size = n;
        return E.SUCCESS;
      },
      fd_filestat_set_times: () => E.SUCCESS,
      fd_advise: () => E.SUCCESS,
      fd_allocate: () => E.SUCCESS,
      fd_sync: () => E.SUCCESS,
      fd_datasync: () => E.SUCCESS,

      fd_close: (fd) => {
        if (!fds.has(fd)) return E.BADF;
        fds.delete(fd);
        return E.SUCCESS;
      },
      fd_renumber: (from, to) => {
        if (!fds.has(from)) return E.BADF;
        fds.set(to, fds.get(from));
        fds.delete(from);
        return E.SUCCESS;
      },
      fd_read: (fd, iovs, count, nreadPtr) => {
        const f = fdNode(fd);
        if (!f) return E.BADF;
        if (f.std !== undefined) { mem().setUint32(nreadPtr, 0, true); return E.SUCCESS; }
        if (f.node.dir) return E.ISDIR;
        const n = readAt(f.node, f.pos, iovecs(iovs, count));
        f.pos += n;
        mem().setUint32(nreadPtr, n, true);
        return E.SUCCESS;
      },
      fd_pread: (fd, iovs, count, offset, nreadPtr) => {
        const f = fdNode(fd);
        if (!f || !f.node) return E.BADF;
        if (f.node.dir) return E.ISDIR;
        mem().setUint32(nreadPtr, readAt(f.node, Number(offset), iovecs(iovs, count)), true);
        return E.SUCCESS;
      },
      fd_write: (fd, iovs, count, nwrittenPtr) => {
        const f = fdNode(fd);
        if (!f) return E.BADF;
        const list = iovecs(iovs, count);
        if (f.std !== undefined) {
          const b = bytes();
          let total = 0;
          for (const [p, len] of list) { (f.std === 1 ? this.stdout : this.stderr).push(b.slice(p, p + len)); total += len; }
          mem().setUint32(nwrittenPtr, total, true);
          return E.SUCCESS;
        }
        if (f.node.dir) return E.ISDIR;
        if (f.append) f.pos = f.node.size;
        const n = writeAt(f.node, f.pos, list);
        f.pos += n;
        mem().setUint32(nwrittenPtr, n, true);
        return E.SUCCESS;
      },
      fd_pwrite: (fd, iovs, count, offset, nwrittenPtr) => {
        const f = fdNode(fd);
        if (!f || !f.node) return E.BADF;
        if (f.node.dir) return E.ISDIR;
        mem().setUint32(nwrittenPtr, writeAt(f.node, Number(offset), iovecs(iovs, count)), true);
        return E.SUCCESS;
      },
      fd_seek: (fd, offset, whence, newPtr) => {
        const f = fdNode(fd);
        if (!f) return E.BADF;
        if (f.std !== undefined) return E.INVAL;
        const base = whence === 0 ? 0 : whence === 1 ? f.pos : (f.node.size || 0);
        const pos = base + Number(offset);
        if (pos < 0) return E.INVAL;
        f.pos = pos;
        mem().setBigUint64(newPtr, BigInt(pos), true);
        return E.SUCCESS;
      },
      fd_tell: (fd, ptr) => {
        const f = fdNode(fd);
        if (!f || f.std !== undefined) return E.BADF;
        mem().setBigUint64(ptr, BigInt(f.pos), true);
        return E.SUCCESS;
      },
      fd_readdir: (fd, buf, bufLen, cookie, usedPtr) => {
        const f = fdNode(fd);
        if (!f || !f.node || !f.node.dir) return E.BADF;
        const entries = [[".", f.node], ["..", f.node], ...f.node.dir];
        const b = bytes(), v = mem();
        let used = 0;
        for (let i = Number(cookie); i < entries.length && used < bufLen; i++) {
          const [name, node] = entries[i];
          const nameBytes = enc.encode(name);
          const head = new DataView(new ArrayBuffer(24));
          head.setBigUint64(0, BigInt(i + 1), true);
          head.setBigUint64(8, BigInt(node.ino), true);
          head.setUint32(16, nameBytes.length, true);
          head.setUint8(20, node.dir ? FILETYPE.DIR : FILETYPE.FILE);
          const entry = new Uint8Array(24 + nameBytes.length);
          entry.set(new Uint8Array(head.buffer), 0);
          entry.set(nameBytes, 24);
          const n = Math.min(entry.length, bufLen - used);   // zu lange Einträge abschneiden, wie vorgesehen
          b.set(entry.subarray(0, n), buf + used);
          used += n;
        }
        v.setUint32(usedPtr, used, true);
        return E.SUCCESS;
      },

      path_open: (dirfd, dirflags, pathPtr, pathLen, oflags, rightsBase, rightsInh, fdflags, fdPtr) => {
        const d = fdNode(dirfd);
        if (!d || !d.node || !d.node.dir) return E.BADF;
        const path = str(pathPtr, pathLen);
        let [node, err] = lookup(this.root, path, d.node);
        if (err === E.NOENT && oflags & OFLAGS.CREAT) {
          const [parent, name, perr] = parentOf(this.root, path, d.node);
          if (perr) return perr;
          node = makeFile();
          parent.dir.set(name, node);
        } else if (err) {
          return err;
        } else {
          if (oflags & OFLAGS.CREAT && oflags & OFLAGS.EXCL) return E.EXIST;
          if (oflags & OFLAGS.DIRECTORY && !node.dir) return E.NOTDIR;
          if (oflags & OFLAGS.TRUNC) {
            if (node.dir) return E.ISDIR;
            node.size = 0; node.mtime = now();
          }
        }
        const fd = this.nextFd++;
        fds.set(fd, { node, pos: 0, append: !!(fdflags & FDFLAGS_APPEND) });
        mem().setUint32(fdPtr, fd, true);
        return E.SUCCESS;
      },
      path_filestat_get: (dirfd, flags, pathPtr, pathLen, ptr) => {
        const d = fdNode(dirfd);
        if (!d || !d.node) return E.BADF;
        const [node, err] = lookup(this.root, str(pathPtr, pathLen), d.node);
        if (err) return err;
        return filestat(node, ptr);
      },
      path_filestat_set_times: () => E.SUCCESS,
      path_create_directory: (dirfd, pathPtr, pathLen) => {
        const d = fdNode(dirfd);
        if (!d || !d.node) return E.BADF;
        const [parent, name, err] = parentOf(this.root, str(pathPtr, pathLen), d.node);
        if (err) return err;
        if (parent.dir.has(name)) return E.EXIST;
        parent.dir.set(name, makeDir());
        return E.SUCCESS;
      },
      path_unlink_file: (dirfd, pathPtr, pathLen) => {
        const d = fdNode(dirfd);
        if (!d || !d.node) return E.BADF;
        const [parent, name, err] = parentOf(this.root, str(pathPtr, pathLen), d.node);
        if (err) return err;
        const node = parent.dir.get(name);
        if (!node) return E.NOENT;
        if (node.dir) return E.ISDIR;
        parent.dir.delete(name);
        return E.SUCCESS;
      },
      path_remove_directory: (dirfd, pathPtr, pathLen) => {
        const d = fdNode(dirfd);
        if (!d || !d.node) return E.BADF;
        const [parent, name, err] = parentOf(this.root, str(pathPtr, pathLen), d.node);
        if (err) return err;
        const node = parent.dir.get(name);
        if (!node) return E.NOENT;
        if (!node.dir) return E.NOTDIR;
        if (node.dir.size) return E.NOTEMPTY;
        parent.dir.delete(name);
        return E.SUCCESS;
      },
      path_rename: (fd1, p1, l1, fd2, p2, l2) => {
        const d1 = fdNode(fd1), d2 = fdNode(fd2);
        if (!d1 || !d1.node || !d2 || !d2.node) return E.BADF;
        const [from, fromName, e1] = parentOf(this.root, str(p1, l1), d1.node);
        if (e1) return e1;
        const [to, toName, e2] = parentOf(this.root, str(p2, l2), d2.node);
        if (e2) return e2;
        const node = from.dir.get(fromName);
        if (!node) return E.NOENT;
        const target = to.dir.get(toName);
        if (target && target.dir && target.dir.size) return E.NOTEMPTY;
        from.dir.delete(fromName);
        to.dir.set(toName, node);
        return E.SUCCESS;
      },
      // Keine symbolischen Links: readlink meldet "kein Link", wie unter Linux
      path_readlink: () => E.INVAL,
      path_symlink: () => E.NOSYS,
      path_link: () => E.NOSYS,
      poll_oneoff: () => E.NOSYS,
    };
  }
}
