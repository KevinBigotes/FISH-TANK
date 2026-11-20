export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;
export const BRUSHES = [{ name: 'Fino', width: 5 }, { name: 'Medio', width: 14 }, { name: 'Grueso', width: 32 }];
export const COLORS = [
  ['#ff6757', 'Coral'], ['#ffad32', 'Naranja'], ['#f5d442', 'Amarillo'], ['#59c97e', 'Verde'],
  ['#21b6b2', 'Turquesa'], ['#4285f4', 'Azul'], ['#9264e8', 'Violeta'], ['#ed65b5', 'Rosa'],
  ['#163b42', 'Tinta'], ['#ffffff', 'Blanco'],
];

export function canvasPoint(clientX, clientY, rect) {
  return {
    x: Math.max(0, Math.min(CANVAS_WIDTH, (clientX - rect.left) / rect.width * CANVAS_WIDTH)),
    y: Math.max(0, Math.min(CANVAS_HEIGHT, (clientY - rect.top) / rect.height * CANVAS_HEIGHT)),
  };
}

export function paintStroke(context, stroke) {
  if (!stroke.points.length) return;
  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    context.beginPath(); context.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2); context.fill();
  } else {
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  context.restore();
}

export function replayDrawing(context, commands) {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const command of commands) {
    if (command.type === 'clear') context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    else paintStroke(context, command);
  }
}

export function containsInk(imageData) {
  for (let index = 3; index < imageData.data.length; index += 4) if (imageData.data[index] !== 0) return true;
  return false;
}
