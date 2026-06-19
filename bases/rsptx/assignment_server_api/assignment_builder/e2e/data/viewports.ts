export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const viewports: Viewport[] = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 360, height: 740 }
];
