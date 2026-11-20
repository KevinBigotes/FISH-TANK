import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import jsQR from 'jsqr';
const requireFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
const { createElement } = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { QRCodeSVG } = requireFrontend('qrcode.react');
const sharp = createRequire(new URL('../services/drawing-processing-service/package.json', import.meta.url))('sharp');

test('un lector QR decodifica la URL completa en Pages y en red local', async () => {
  for (const value of ['https://kevinbigotes.github.io/FISH-TANK/#/dibujar', 'http://192.168.1.10:5173/#/dibujar']) {
    const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 360, marginSize: 4, level: 'M', fgColor: '#103936' }));
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert.equal(decoded?.data, value);
  }
});
