import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.join(process.cwd(), "public", "icons");
await mkdir(outputDirectory, { recursive: true });

const sourcePath = path.join(outputDirectory, "豆包.png");
const source = sharp(sourcePath).extract({ left: 170, top: 170, width: 1708, height: 1708 });

const targets = [
  ["icon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["icon-1024.png", 1024],
];

await Promise.all(targets.map(([filename, size]) =>
  source.clone().resize(Number(size), Number(size), { fit: "cover" }).png({ compressionLevel: 9 }).toFile(path.join(outputDirectory, String(filename))),
));
