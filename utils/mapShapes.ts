import type { Map as MLMap } from "maplibre-gl";

/** Registers small diamond / square marker images used by symbol layers. */
export function addShapeImages(m: MLMap) {
  const make = (id: string, color: string, shape: "diamond" | "square", size = 22, stroke = "#ffffff") => {
    if (m.hasImage(id)) return;
    const c = document.createElement("canvas");
    const r = 2;
    c.width = c.height = size * r;
    const g = c.getContext("2d")!;
    g.scale(r, r);
    g.fillStyle = color;
    g.strokeStyle = stroke;
    g.lineWidth = 2.5;
    g.beginPath();
    if (shape === "diamond") {
      const h = size / 2;
      g.moveTo(h, 2);
      g.lineTo(size - 2, h);
      g.lineTo(h, size - 2);
      g.lineTo(2, h);
      g.closePath();
    } else g.rect(4, 4, size - 8, size - 8);
    g.fill();
    g.stroke();
    m.addImage(id, g.getImageData(0, 0, c.width, c.height), { pixelRatio: r });
  };
  make("diamond-cyan", "#00D4FF", "diamond", 24);
  make("diamond-cyan-plan", "#00D4FF", "diamond", 24, "#FBBF24");
  make("diamond-red", "#C0353E", "diamond", 24);
  make("square-amber", "#F59E0B", "square", 14);
  make("square-amber-plan", "#FDE68A", "square", 14, "#F59E0B");
  make("square-slate", "#61718B", "square", 14);
}
