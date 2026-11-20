import sharp from 'sharp';
import { HttpError } from '@fish-tank/service-core';
import { MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES } from './config.js';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export async function cropTransparentPng(input) {
  if (!Buffer.isBuffer(input) || !input.subarray(0, 8).equals(pngSignature)) {
    throw new HttpError(415, 'PNG_REQUIRED', 'Envía un dibujo en formato PNG.');
  }
  if (input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'FILE_TOO_LARGE', 'El dibujo supera los 5 MB.');
  try {
    const decoder = sharp(input, { limitInputPixels: MAX_IMAGE_SIDE ** 2, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (metadata.format !== 'png' || (metadata.pages || 1) !== 1) {
      throw new HttpError(415, 'PNG_REQUIRED', 'Usa un PNG estático, sin animación.');
    }
    if (metadata.width > MAX_IMAGE_SIDE || metadata.height > MAX_IMAGE_SIDE) {
      throw new HttpError(413, 'IMAGE_TOO_LARGE', 'El dibujo debe medir como máximo 2048 × 2048 píxeles.');
    }
    const { data, info } = await decoder.toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    // Solo el alfa decide los bordes: no recortar trazos blancos ni colores claros.
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] !== 0) {
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < 0) throw new HttpError(422, 'EMPTY_DRAWING', 'Dibuja algo antes de soltar tu pez.');
    const width = right - left + 1, height = bottom - top + 1;
    const buffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left, top, width, height }).png({ compressionLevel: 9 }).toBuffer();
    if (buffer.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'FILE_TOO_LARGE', 'El PNG final supera los 5 MB.');
    return { buffer, width, height };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, 'INVALID_IMAGE', 'No se pudo leer ese PNG. Vuelve a dibujar e inténtalo otra vez.');
  }
}
