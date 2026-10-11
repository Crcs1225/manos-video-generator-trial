import type { Illustration } from "./illustration.ts";

// Keep all artwork above the bottom caption band, including malformed geometry.
export function paintIllustration(context: CanvasRenderingContext2D, scene: Illustration) {
  context.fillStyle = scene.background; context.fillRect(0, 0, 1280, 720);
  context.save(); context.beginPath(); context.rect(40, 150, 1200, 370); context.clip();
  for (const shape of scene.shapes) {
    context.fillStyle = shape.color; context.strokeStyle = shape.color; context.lineWidth = 7;
    context.beginPath();
    if (shape.kind === "rect") context.fillRect(shape.x, shape.y, shape.w, shape.h);
    else if (shape.kind === "circle" || shape.kind === "ellipse") { context.ellipse(shape.x + shape.w / 2, shape.y + shape.h / 2, shape.w / 2, shape.h / 2, 0, 0, Math.PI * 2); context.fill(); }
    else if (shape.kind === "triangle") { context.moveTo(shape.x + shape.w / 2, shape.y); context.lineTo(shape.x + shape.w, shape.y + shape.h); context.lineTo(shape.x, shape.y + shape.h); context.closePath(); context.fill(); }
    else if (shape.kind === "text") { context.font = `${Math.max(14, Math.min(26, shape.h))}px monospace`; context.fillText(shape.text || "", shape.x, shape.y + shape.h, shape.w); }
    else { context.moveTo(shape.x, shape.y); context.lineTo(shape.x + shape.w, shape.y + shape.h); context.stroke(); }
  }
  context.restore();
  context.fillStyle = "#101c25"; context.fillRect(0, 540, 1280, 180);
  context.fillStyle = "#d8f278"; context.font = "16px Arial"; context.fillText("MANOS / TOPIC ILLUSTRATION", 70, 40);
  context.fillStyle = "#ffffff";
  let size = 34;
  while (size > 18) {
    context.font = `${size}px Arial`;
    if (context.measureText(scene.title).width <= 1120) break;
    size -= 2;
  }
  context.font = `${size}px Arial`; context.fillText(scene.title, 70, 102, 1120);
}
