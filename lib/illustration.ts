export type Shape = { kind: "circle" | "rect" | "ellipse" | "line" | "triangle" | "text"; x: number; y: number; w: number; h: number; color: string; text?: string };
export type Illustration = { title: string; background: string; shapes: Shape[] };
export type VisualPlan = { scenes: Illustration[]; warnings: string[] };
export function illustrationGeometryKey(scene: Illustration): string {
  return scene.shapes.filter((shape) => shape.kind !== "text").map(({ kind, x, y, w, h }) => JSON.stringify([kind === "circle" ? "ellipse" : kind, x, y, w, h])).sort().join("|");
}
const color = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export function validateIllustrations(value: unknown): Illustration[] {
  if (!value || typeof value !== "object" || !("scenes" in value) || !Array.isArray(value.scenes) || !value.scenes.length || value.scenes.length > 3) throw new Error("Invalid illustrations.");
  return value.scenes.map((scene) => {
    if (!scene || typeof scene.title !== "string" || scene.title.length > 100 || !color(scene.background) || !Array.isArray(scene.shapes) || scene.shapes.length < 3 || scene.shapes.length > 50) throw new Error("Invalid illustration scene.");
    const shapes = scene.shapes.map((shape: Shape) => {
      if (!shape || !["circle", "rect", "ellipse", "line", "triangle", "text"].includes(shape.kind) || !color(shape.color) || ![shape.x, shape.y, shape.w, shape.h].every(Number.isFinite) || shape.x < 0 || shape.x > 1280 || shape.y < 0 || shape.y > 720 || shape.w <= 0 || shape.w > 1280 || shape.h <= 0 || shape.h > 720) throw new Error("Invalid illustration shape.");
      if (shape.kind === "text" && (typeof shape.text !== "string" || !shape.text.trim() || shape.text.length > 80)) throw new Error("Invalid illustration label.");
      return { kind: shape.kind, x: shape.x, y: shape.y, w: shape.w, h: shape.h, color: shape.color, ...(shape.kind === "text" ? { text: shape.text } : {}) };
    });
    return { title: scene.title, background: scene.background, shapes };
  });
}

export function localIllustrations(topic: string, script: string): Illustration[] {
  const subject = topic.toLowerCase();
  const s = (kind: Shape["kind"], x: number, y: number, w: number, h: number, color: string, text?: string): Shape => ({ kind, x, y, w, h, color, ...(text ? { text } : {}) });
  const label = (text: string, x: number, y: number, w = 450) => s("text", x, y, w, 24, "#ffffff", text.slice(0, 80));
  const monitor = (code: string[]) => [s("rect", 240, 170, 800, 270, "#81b9c8"), s("rect", 255, 190, 770, 230, "#14232e"), ...code.map((line, n) => label(line, 300, 230 + n * 48, 640)), s("rect", 580, 440, 120, 32, "#81b9c8"), s("rect", 460, 470, 360, 15, "#81b9c8")];
  const cup = (x: number, y: number, scale = 1) => [s("rect", x, y, 240 * scale, 145 * scale, "#f5ede0"), s("ellipse", x + 200 * scale, y + 12 * scale, 95 * scale, 85 * scale, "#f5ede0"), s("ellipse", x, y - 20 * scale, 240 * scale, 48 * scale, "#573623"), s("ellipse", x - 25 * scale, y + 145 * scale, 320 * scale, 20 * scale, "#91abb5")];
  const tree = (x: number, y: number, scale = 1) => [s("rect", x + 70 * scale, y + 110 * scale, 25 * scale, 100 * scale, "#ab805a"), s("circle", x, y, 170 * scale, 170 * scale, "#82b28b")];
  let pictures: Shape[][], titles: string[];
  if (/typescript|javascript|programming|software|computer|coding|code\b/.test(subject)) {
    titles = ["Write typed code", "Check types before running", "Run in the browser"];
    const typed = /typescript/.test(subject);
    pictures = [monitor(typed ? ['const name: string = "Manos";', 'const count: number = 3;', 'console.log(name);'] : ['const name = "Manos";', 'const count = 3;', 'console.log(name);']),
      [s("rect", 130, 220, 300, 210, "#244553"), label("Source code", 165, 260, 230), label(typed ? "name: string" : "name = text", 165, 315, 230), s("line", 430, 320, 100, 2, "#d8f278"), s("triangle", 515, 305, 28, 30, "#d8f278"), s("rect", 550, 220, 230, 210, "#365b49"), label("Type checker", 570, 265, 185), label("Check passed", 570, 325, 185), s("line", 780, 320, 110, 2, "#d8f278"), s("rect", 910, 240, 240, 165, "#244553"), label("JavaScript", 935, 300, 185)],
      [s("rect", 245, 175, 790, 320, "#eef4ef"), s("rect", 245, 175, 790, 45, "#81b9c8"), s("circle", 265, 190, 12, 12, "#e5ae81"), s("circle", 290, 190, 12, 12, "#d8f278"), s("rect", 300, 255, 245, 170, "#365b49"), label("Hello, Manos!", 320, 315, 210), s("rect", 600, 260, 350, 25, "#81b9c8"), s("rect", 600, 310, 280, 20, "#81b9c8"), s("rect", 600, 360, 320, 20, "#81b9c8")]];
  } else if (/solar|planet|space|star|moon|universe/.test(subject)) {
    titles = ["Our planetary system", "A closer view", "Different worlds"];
    pictures = [[s("circle", 100, 205, 210, 210, "#f5ba49"), ...[0, 1, 2, 3].map((n) => s("circle", 430 + n * 165, 300 - n * 28, 45 + n * 17, 45 + n * 17, ["#e59170", "#78b8ce", "#80a782", "#d8ae79"][n]))],
      [s("circle", 365, 175, 290, 290, "#78b8ce"), s("ellipse", 430, 235, 145, 90, "#80a782"), s("ellipse", 505, 330, 75, 100, "#80a782"), s("circle", 850, 235, 90, 90, "#d3d8db"), s("line", 660, 310, 180, 2, "#81a4b3")],
      [s("circle", 225, 240, 110, 110, "#e59170"), s("circle", 535, 195, 210, 210, "#78b8ce"), s("circle", 900, 165, 300, 300, "#d8ae79"), label("Illustration — not to scale", 360, 478, 650)]];
  } else if (/coffee|tea|drink|cocoa/.test(subject)) {
    titles = ["Where the flavor begins", "Preparing the drink", "Ready to enjoy"];
    pictures = [[...[0, 1, 2, 3, 4].flatMap((n) => [s("ellipse", 220 + n * 155, 240 + (n % 2) * 80, 110, 155, "#9b6542"), s("line", 267 + n * 155, 260 + (n % 2) * 80, 10, 105, "#573623")])],
      [...cup(430, 340), s("triangle", 420, 165, 270, 140, "#91abb5"), s("rect", 445, 190, 220, 12, "#573623"), s("line", 555, 305, 2, 42, "#9b6542")],
      [...cup(280, 300), ...cup(755, 310, .85), s("line", 375, 200, 8, 75, "#91abb5"), s("line", 465, 180, 8, 95, "#91abb5"), s("ellipse", 630, 425, 70, 45, "#9b6542")]];
  } else if (/mount|mountain|fuji|landscape|volcano/.test(subject)) {
    titles = ["The landscape", "A closer look", "Exploring the mountain"];
    pictures = [[s("circle", 990, 160, 80, 80, "#f5ba49"), s("triangle", 90, 240, 550, 265, "#70939c"), s("triangle", 460, 180, 620, 325, "#a3bbc1"), s("triangle", 665, 180, 210, 110, "#f4f3eb")],
      [s("triangle", 200, 160, 890, 345, "#70939c"), s("triangle", 515, 160, 260, 115, "#f4f3eb"), s("ellipse", 170, 375, 170, 40, "#a3bbc1"), s("ellipse", 920, 285, 210, 40, "#a3bbc1")],
      [s("triangle", 570, 180, 500, 310, "#70939c"), s("line", 230, 420, 450, 35, "#e5ae81"), s("circle", 345, 265, 38, 38, "#e5ae81"), s("rect", 347, 307, 32, 65, "#d8f278"), s("line", 350, 365, 10, 70, "#e5ae81"), s("line", 380, 365, 25, 70, "#e5ae81"), s("line", 410, 315, 1, 115, "#91abb5")]];
  } else if (/plant|tree|forest|nature|growth|flower/.test(subject)) {
    titles = ["A small beginning", "Growing a tree", "A living forest"];
    pictures = [[s("rect", 150, 430, 980, 60, "#573623"), s("rect", 620, 285, 18, 150, "#82b28b"), s("ellipse", 490, 270, 140, 70, "#82b28b"), s("ellipse", 635, 240, 140, 70, "#d8f278"), s("line", 615, 435, 55, 40, "#e5ae81")],
      [...tree(460, 180, 1.4), s("rect", 150, 475, 980, 20, "#365b49"), s("circle", 955, 170, 75, 75, "#f5ba49")],
      [...tree(155, 245), ...tree(415, 175, 1.45), ...tree(765, 225, 1.1), s("rect", 80, 485, 1120, 20, "#365b49")]];
  } else {
    const words = script.trim().split(/\s+/), step = Math.ceil(words.length / 3);
    const excerpts = [0, 1, 2].map((index) => words.slice(index * step, (index + 1) * step).slice(0, 10).join(" "));
    titles = ["The idea", "How it connects", "Key takeaway"];
    pictures = [[s("rect", 320, 170, 640, 325, "#244553"), s("rect", 360, 210, 420, 18, "#d8f278"), label(excerpts[0], 360, 280, 550), s("rect", 360, 340, 520, 12, "#81b9c8"), s("rect", 360, 385, 400, 12, "#81b9c8")],
      [s("circle", 110, 240, 180, 180, "#365b49"), s("circle", 550, 190, 240, 240, "#244553"), s("circle", 990, 270, 155, 155, "#573623"), s("line", 290, 320, 250, 2, "#81b9c8"), s("line", 790, 325, 195, 2, "#81b9c8"), label(excerpts[1], 340, 465, 700)],
      [s("rect", 255, 185, 760, 295, "#244553"), s("line", 350, 330, 70, 70, "#d8f278"), s("line", 425, 310, 140, 1, "#d8f278"), label(excerpts[2], 590, 300, 370), s("rect", 590, 375, 300, 12, "#81b9c8")]];
  }
  return pictures.map((shapes, index) => ({ title: `${topic.slice(0, 64)} · ${titles[index]}`, background: "#101c25", shapes }));
}
