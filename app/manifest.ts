import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "金结闸典｜水工钢闸门参数检索",
    short_name: "金结闸典",
    description: "按孔口尺寸、设计水头和闸门自重检索水工金属结构设备资料。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f1eb",
    theme_color: "#174d3d",
    orientation: "any",
    lang: "zh-CN",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
