import type { MapMouseEvent } from "maplibre-gl";

type Mode = "polygon" | "line" | "point";
type Coord = [number, number];

const active = ref<Mode | null>(null);
const vertexCount = ref(0);
let cleanup: (() => void) | null = null;
let finishFn: (() => void) | null = null;

const SRC = "draw-temp";

/**
 * Small click-to-draw helper (polygon / line / point).
 * Click to add vertices, double-click or Enter to finish, Esc to cancel.
 */
export function useDraw() {
  const { map, setData, addLayer } = useMap();

  function ensureLayers() {
    const m = map.value!;
    if (!m.getSource(SRC)) {
      setData(SRC, EMPTY_FC);
      addLayer({ id: "draw-fill", type: "fill", source: SRC, filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#3672F9", "fill-opacity": 0.18 } });
      addLayer({ id: "draw-line", type: "line", source: SRC, filter: ["!=", "$type", "Point"], paint: { "line-color": "#3672F9", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
      addLayer({ id: "draw-vertex", type: "circle", source: SRC, filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#0F47B3", "circle-stroke-width": 2 } });
    } else {
      ["draw-fill", "draw-line", "draw-vertex"].forEach((id) => m.moveLayer(id));
    }
  }

  function render(coords: Coord[], hover: Coord | null, mode: Mode) {
    const pts = hover ? [...coords, hover] : coords;
    const features: any[] = coords.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
    if (mode === "polygon" && pts.length >= 3) {
      features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] }, properties: {} });
    } else if (pts.length >= 2) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} });
    }
    setData(SRC, { type: "FeatureCollection", features });
  }

  function clear() {
    if (map.value?.getSource(SRC)) setData(SRC, EMPTY_FC);
  }

  function cancel() {
    cleanup?.();
    clear();
  }

  function start(mode: Mode): Promise<any | null> {
    cancel();
    const m = map.value;
    if (!m) return Promise.resolve(null);
    ensureLayers();
    active.value = mode;
    vertexCount.value = 0;
    const coords: Coord[] = [];
    m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = "crosshair";

    return new Promise((resolve) => {
      const finish = () => {
        let geom: any = null;
        if (mode === "polygon" && coords.length >= 3) geom = { type: "Polygon", coordinates: [[...coords, coords[0]]] };
        if (mode === "line" && coords.length >= 2) geom = { type: "LineString", coordinates: [...coords] };
        if (mode === "point" && coords.length >= 1) geom = { type: "Point", coordinates: coords[0] };
        done(geom);
      };
      const done = (geom: any) => {
        cleanup?.();
        resolve(geom ? { type: "Feature", geometry: geom, properties: {} } : null);
      };
      const onClick = (e: MapMouseEvent) => {
        const c: Coord = [e.lngLat.lng, e.lngLat.lat];
        // ignore the 2nd click of a double-click
        const last = coords[coords.length - 1];
        if (last && Math.abs(last[0] - c[0]) < 1e-9 && Math.abs(last[1] - c[1]) < 1e-9) return;
        coords.push(c);
        vertexCount.value = coords.length;
        if (mode === "point") return finish();
        render(coords, null, mode);
      };
      const onMove = (e: MapMouseEvent) => {
        if (!coords.length) return;
        render(coords, [e.lngLat.lng, e.lngLat.lat], mode);
      };
      const onDbl = (e: MapMouseEvent) => {
        e.preventDefault();
        finish();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") done(null);
        if (e.key === "Enter") finish();
        if (e.key === "Backspace" && coords.length) {
          coords.pop();
          vertexCount.value = coords.length;
          render(coords, null, mode);
        }
      };
      m.on("click", onClick);
      m.on("mousemove", onMove);
      m.on("dblclick", onDbl);
      window.addEventListener("keydown", onKey);
      cleanup = () => {
        m.off("click", onClick);
        m.off("mousemove", onMove);
        m.off("dblclick", onDbl);
        window.removeEventListener("keydown", onKey);
        m.getCanvas().style.cursor = "";
        setTimeout(() => m.doubleClickZoom.enable(), 300);
        active.value = null;
        cleanup = null;
        finishFn = null;
        clear();
      };
      finishFn = finish;
    });
  }

  /** Finish the current drawing (same as pressing Enter). */
  function finishNow() {
    finishFn?.();
  }

  return { active, vertexCount, start, cancel, finishNow, clear };
}
