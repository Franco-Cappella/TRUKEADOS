// GIF animados para la foto de perfil: si pesan más de lo que se guarda (AVATAR.gifMaxBytes), se achican en el
// navegador. Se decodifican los cuadros con ImageDecoder, se recortan al centro, se pasan a 256 colores fijos
// (3-3-2, con un tramado ordenado) y se vuelven a armar como GIF. Sin librerías. encodeGif no usa el DOM (tests).

// Paleta fija de 256 colores: 8 niveles de rojo, 8 de verde y 4 de azul.
const PALETTE = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) {
  PALETTE[i * 3] = Math.round((((i >> 5) & 7) * 255) / 7);
  PALETTE[i * 3 + 1] = Math.round((((i >> 2) & 7) * 255) / 7);
  PALETTE[i * 3 + 2] = Math.round(((i & 3) * 255) / 3);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Píxeles RGBA (w×h) -> índices de la paleta. */
export function quantize(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      const r = clamp(rgba[i * 4] + t * 36);
      const g = clamp(rgba[i * 4 + 1] + t * 36);
      const b = clamp(rgba[i * 4 + 2] + t * 85);
      out[i] = (Math.round((r * 7) / 255) << 5) | (Math.round((g * 7) / 255) << 2) | Math.round((b * 3) / 255);
    }
  }
  return out;
}

// LZW de GIF (códigos de largo variable, hasta 12 bits), empaquetado de a sub-bloques de 255 bytes.
function lzw(indices, out) {
  const min = 8;
  const clear = 1 << min;
  const eoi = clear + 1;
  let size = min + 1;
  let next = eoi + 1;
  let dict = new Map();
  const bytes = [];
  let cur = 0;
  let bits = 0;
  const emit = (code) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      size = min + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << size) size++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) bytes.push(cur & 255);
  out.push(min);
  for (let i = 0; i < bytes.length; i += 255) {
    const n = Math.min(255, bytes.length - i);
    out.push(n);
    for (let j = 0; j < n; j++) out.push(bytes[i + j]);
  }
  out.push(0);
}

/**
 * Arma un GIF animado que se repite siempre. frames: [{ indices (w*h índices de la paleta), delay (ms) }].
 * Devuelve los bytes (Uint8Array).
 */
export function encodeGif(w, h, frames) {
  const out = [];
  const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
  for (const ch of 'GIF89a') out.push(ch.charCodeAt(0));
  u16(w);
  u16(h);
  out.push(0xf7, 0, 0); // tabla de colores global de 256
  for (const v of PALETTE) out.push(v);
  out.push(0x21, 0xff, 0x0b);
  for (const ch of 'NETSCAPE2.0') out.push(ch.charCodeAt(0));
  out.push(3, 1, 0, 0, 0); // se repite para siempre
  for (const f of frames) {
    out.push(0x21, 0xf9, 4, 0x04); // cada cuadro tapa al anterior
    u16(Math.max(2, Math.round((f.delay || 100) / 10)));
    out.push(0, 0);
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(w);
    u16(h);
    out.push(0);
    lzw(f.indices, out);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

// Intentos, de mejor a peor, hasta que entre en el límite.
const TRIES = [
  { size: 128, frames: 60 },
  { size: 112, frames: 40 },
  { size: 96, frames: 30 },
  { size: 72, frames: 20 },
];

const toDataUrl = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:image/gif;base64,' + btoa(s);
};

export const canShrinkGif = () => typeof window !== 'undefined' && 'ImageDecoder' in window;

/** Achica un GIF (File) hasta que pese como mucho maxBytes. Devuelve un data URL, o null si no se pudo. */
export async function shrinkGif(file, maxBytes, background = '#2a2a2a') {
  const dec = new window.ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' });
  await dec.tracks.ready;
  const count = Math.max(1, dec.tracks.selectedTrack?.frameCount || 1);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    for (const t of TRIES) {
      const step = Math.max(1, count / t.frames);
      const frames = [];
      canvas.width = canvas.height = t.size;
      for (let k = 0; Math.floor(k * step) < count; k++) {
        const { image } = await dec.decode({ frameIndex: Math.floor(k * step) });
        const iw = image.displayWidth;
        const ih = image.displayHeight;
        const side = Math.min(iw, ih);
        ctx.fillStyle = background; // sin transparencia: lo transparente queda del color de fondo
        ctx.fillRect(0, 0, t.size, t.size);
        ctx.drawImage(image, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, t.size, t.size);
        const delay = ((image.duration || 100_000) / 1000) * step; // µs -> ms, sumando los cuadros salteados
        image.close();
        frames.push({ indices: quantize(ctx.getImageData(0, 0, t.size, t.size).data, t.size, t.size), delay });
      }
      const bytes = encodeGif(t.size, t.size, frames);
      if (bytes.length <= maxBytes) return toDataUrl(bytes);
    }
    return null;
  } finally {
    dec.close();
  }
}
