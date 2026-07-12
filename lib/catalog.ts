export type Zone = "floor" | "desk" | "wall-left" | "wall-right";
export type Category = "desk" | "monitor" | "chair" | "mouse" | "keyboard" | "headphones" | "plant";

export interface Product {
  id: string;
  name: string;
  category: Category;
  variation: string;
  zone: Zone;
  widthM: number;
  depthM: number;
  heightM: number;
  weeklyPrice: number;
  sprite: string;
  displayWidth: number;
  displayHeight: number;
  anchorX: number;
  anchorY: number;
  fixed?: boolean;
}

const product = (value: Product) => value;

export const PRODUCTS: Product[] = [
  product({ id: "desk-graphite", name: "Graphite Studio Desk", category: "desk", variation: "Graphite", zone: "floor", widthM: 2, depthM: 1, heightM: 0.75, weeklyPrice: 18, sprite: "/sprites/desk-graphite.png", displayWidth: 330, displayHeight: 245, anchorX: 211, anchorY: 147, fixed: true }),
  product({ id: "desk-oak", name: "Warm Oak Studio Desk", category: "desk", variation: "Oak", zone: "floor", widthM: 2, depthM: 1, heightM: 0.75, weeklyPrice: 21, sprite: "/sprites/desk-oak.png", displayWidth: 330, displayHeight: 245, anchorX: 211, anchorY: 147, fixed: true }),
  product({ id: "monitor-black", name: "27-inch Monitor", category: "monitor", variation: "Black", zone: "desk", widthM: 0.62, depthM: 0.22, heightM: 0.48, weeklyPrice: 9, sprite: "/sprites/monitor-black.png?v=2", displayWidth: 126, displayHeight: 116, anchorX: 63, anchorY: 108 }),
  product({ id: "monitor-white", name: "27-inch Monitor", category: "monitor", variation: "White", zone: "desk", widthM: 0.62, depthM: 0.22, heightM: 0.48, weeklyPrice: 10, sprite: "/sprites/monitor-white.png", displayWidth: 126, displayHeight: 116, anchorX: 63, anchorY: 108 }),
  product({ id: "chair-mesh", name: "Mesh Task Chair", category: "chair", variation: "Mesh", zone: "floor", widthM: 0.7, depthM: 0.7, heightM: 1.15, weeklyPrice: 12, sprite: "/sprites/chair-mesh.png", displayWidth: 170, displayHeight: 205, anchorX: 85, anchorY: 160 }),
  product({ id: "chair-soft", name: "Soft Task Chair", category: "chair", variation: "Soft", zone: "floor", widthM: 0.7, depthM: 0.7, heightM: 1.1, weeklyPrice: 14, sprite: "/sprites/chair-soft.png", displayWidth: 170, displayHeight: 198, anchorX: 85, anchorY: 182 }),
  product({ id: "mouse-black", name: "Wireless Mouse", category: "mouse", variation: "Black", zone: "desk", widthM: 0.07, depthM: 0.12, heightM: 0.04, weeklyPrice: 2, sprite: "/sprites/mouse-black.png?v=2", displayWidth: 38, displayHeight: 29, anchorX: 19, anchorY: 22 }),
  product({ id: "mouse-sand", name: "Wireless Mouse", category: "mouse", variation: "Sand", zone: "desk", widthM: 0.07, depthM: 0.12, heightM: 0.04, weeklyPrice: 2, sprite: "/sprites/mouse-sand.png", displayWidth: 38, displayHeight: 29, anchorX: 19, anchorY: 22 }),
  product({ id: "keyboard-black", name: "Compact Keyboard", category: "keyboard", variation: "Black", zone: "desk", widthM: 0.44, depthM: 0.14, heightM: 0.03, weeklyPrice: 3, sprite: "/sprites/keyboard-black.png?v=2", displayWidth: 88, displayHeight: 48, anchorX: 44, anchorY: 38 }),
  product({ id: "keyboard-white", name: "Compact Keyboard", category: "keyboard", variation: "White", zone: "desk", widthM: 0.44, depthM: 0.14, heightM: 0.03, weeklyPrice: 3, sprite: "/sprites/keyboard-white.png", displayWidth: 88, displayHeight: 48, anchorX: 44, anchorY: 38 }),
  product({ id: "headphones-blue", name: "Studio Headphones", category: "headphones", variation: "Blue", zone: "desk", widthM: 0.2, depthM: 0.2, heightM: 0.32, weeklyPrice: 4, sprite: "/sprites/headphones-blue.png", displayWidth: 70, displayHeight: 78, anchorX: 35, anchorY: 71 }),
  product({ id: "headphones-black", name: "Studio Headphones", category: "headphones", variation: "Black", zone: "desk", widthM: 0.2, depthM: 0.2, heightM: 0.32, weeklyPrice: 4, sprite: "/sprites/headphones-black.png", displayWidth: 70, displayHeight: 78, anchorX: 35, anchorY: 71 }),
  product({ id: "plant-snake", name: "Snake Plant", category: "plant", variation: "Snake", zone: "floor", widthM: 0.45, depthM: 0.45, heightM: 1.1, weeklyPrice: 5, sprite: "/sprites/plant-snake.png", displayWidth: 116, displayHeight: 196, anchorX: 58, anchorY: 184 }),
  product({ id: "plant-palm", name: "Parlor Palm", category: "plant", variation: "Palm", zone: "floor", widthM: 0.5, depthM: 0.5, heightM: 1.2, weeklyPrice: 6, sprite: "/sprites/plant-palm.png", displayWidth: 130, displayHeight: 210, anchorX: 65, anchorY: 196 }),
];

export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((item) => [item.id, item])) as Record<string, Product>;
