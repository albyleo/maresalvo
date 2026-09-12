export namespace GeoJSON {
  interface Point {
    type: "Point";
    coordinates: [number, number] | number[];
  }

  interface Polygon {
    type: "Polygon";
    coordinates: number[][][];
  }

  interface MultiPolygon {
    type: "MultiPolygon";
    coordinates: number[][][][];
  }
}

export {};
