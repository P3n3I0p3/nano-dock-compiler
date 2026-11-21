// Entpackt gzip-Dateien in reinem JavaScript (nano-dock-compiler, Apache 2.0).
// Nur für Browser ohne DecompressionStream (Safari vor 16.4, z. B. iPad mini 4 mit iPadOS 15).
// Neuere Browser entpacken mit DecompressionStream, das ist schneller.
//
// DEFLATE nach RFC 1951, gzip-Rahmen nach RFC 1952. Huffman-Codes bis 9 Bit über eine Tabelle,
// längere (selten) Bit für Bit.

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const FAST = 9;
const FAST_MASK = (1 << FAST) - 1;

// Huffman-Tabelle aus Codelängen (kanonische Codes wie in RFC 1951, 3.2.2)
function build(lens, n) {
  const counts = new Uint16Array(16);
  for (let i = 0; i < n; i++) counts[lens[i]]++;
  counts[0] = 0;
  const start = new Uint16Array(16);
  for (let l = 1; l < 16; l++) start[l] = start[l - 1] + counts[l - 1];
  const symbols = new Uint16Array(n);
  const pos = start.slice();
  for (let i = 0; i < n; i++) if (lens[i]) symbols[pos[lens[i]]++] = i;
  // Schnelltabelle: die nächsten 9 Bit (im Strom zuerst das niedrigste) -> Symbol und Länge
  const fast = new Int32Array(1 << FAST).fill(-1);
  let code = 0;
  for (let l = 1; l <= FAST; l++) {
    for (let k = 0; k < counts[l]; k++) {
      const sym = symbols[start[l] + k];
      let rev = 0;
      for (let b = 0; b < l; b++) rev |= ((code >> b) & 1) << (l - 1 - b);
      for (let j = rev; j < (1 << FAST); j += 1 << l) fast[j] = (sym << 4) | l;
      code++;
    }
    code <<= 1;
  }
  return { counts, symbols, fast };
}

const FIXED_LIT = (() => {
  const l = new Uint8Array(288);
  l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
  return build(l, 288);
})();
const FIXED_DIST = build(new Uint8Array(30).fill(5), 30);

export function inflateRaw(src, pos, out) {
  let p = pos, o = 0, bitbuf = 0, bitcnt = 0;
  const n = src.length;

  const need = (k) => {            // k <= 24
    while (bitcnt < k) { bitbuf |= (p < n ? src[p] : 0) << bitcnt; p++; bitcnt += 8; }
  };
  const bits = (k) => {
    need(k);
    const v = bitbuf & ((1 << k) - 1);
    bitbuf >>>= k; bitcnt -= k;
    return v;
  };
  const decode = (t) => {
    need(16);
    const e = t.fast[bitbuf & FAST_MASK];
    if (e >= 0) { const l = e & 15; bitbuf >>>= l; bitcnt -= l; return e >> 4; }
    let code = 0, first = 0, index = 0;   // langer Code: Bit für Bit
    for (let l = 1; l < 16; l++) {
      code |= bitbuf & 1; bitbuf >>>= 1; bitcnt--;
      const count = t.counts[l];
      if (code - count < first) return t.symbols[index + (code - first)];
      index += count; first += count; first <<= 1; code <<= 1;
    }
    throw new Error("gzip: ungültiger Huffman-Code");
  };

  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {                      // ungepackt
      bits(bitcnt & 7);
      const len = bits(16);
      bits(16);
      let k = len;
      while (k > 0 && bitcnt >= 8) { out[o++] = bits(8); k--; }
      // Bytes, die need() schon über das Ende gelesen hat, zurückgeben
      p -= bitcnt >> 3; bitbuf = 0; bitcnt = 0;
      out.set(src.subarray(p, p + k), o);
      o += k; p += k;
      continue;
    }
    let lit, dist;
    if (type === 1) { lit = FIXED_LIT; dist = FIXED_DIST; }
    else if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
      const clt = build(cl, 19);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const sym = decode(clt);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep, val = 0;
          if (sym === 16) { if (!i) throw new Error("gzip: ungültige Codelängen"); val = lens[i - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > hlit + hdist) throw new Error("gzip: ungültige Codelängen");
          lens.fill(val, i, i + rep); i += rep;
        }
      }
      lit = build(lens.subarray(0, hlit), hlit);
      dist = build(lens.subarray(hlit), hdist);
    } else throw new Error("gzip: ungültiger Blocktyp");

    for (;;) {
      let sym = decode(lit);
      if (sym < 256) { out[o++] = sym; continue; }
      if (sym === 256) break;
      sym -= 257;
      const len = LBASE[sym] + bits(LEXT[sym]);
      const ds = decode(dist);
      const d = DBASE[ds] + bits(DEXT[ds]);
      let s = o - d;
      if (s < 0) throw new Error("gzip: Abstand zu groß");
      for (let k = 0; k < len; k++) out[o++] = out[s++];
    }
  }
  return o;
}

// gzip-Datei (Uint8Array) -> entpackte Daten (Uint8Array)
export function gunzipSync(src) {
  if (src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error("keine gzip-Datei");
  const flg = src[3];
  let p = 10;
  if (flg & 4) p += 2 + (src[p] | (src[p + 1] << 8));    // FEXTRA
  if (flg & 8) while (src[p++]);                          // FNAME
  if (flg & 16) while (src[p++]);                         // FCOMMENT
  if (flg & 2) p += 2;                                    // FHCRC
  const n = src.length;
  const size = (src[n - 4] | (src[n - 3] << 8) | (src[n - 2] << 16) | (src[n - 1] << 24)) >>> 0;
  const out = new Uint8Array(size);                       // Größe steht am Ende der Datei
  const got = inflateRaw(src, p, out);
  if (got !== size) throw new Error(`gzip: ${got} statt ${size} Bytes entpackt`);
  return out;
}
