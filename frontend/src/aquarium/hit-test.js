export function hitSprite(point, sprite) {
  const { x, y, angle, sx, sy, width, height, mask } = sprite;
  if (!mask || Math.abs(sx) < 0.05) return false;
  const dx = point.x - x, dy = point.y - y;
  const u = (dx * Math.cos(angle) + dy * Math.sin(angle)) / sx / width + 0.5;
  const v = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / sy / height + 0.5;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  return mask.alpha[Math.floor(v * mask.height) * mask.width + Math.floor(u * mask.width)] > 10;
}
