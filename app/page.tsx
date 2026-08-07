import type { Metadata } from "next";
import { GateFinder } from "./GateFinder";

export const metadata: Metadata = {
  title: "金结闸典｜水工钢闸门参数检索",
  description: "按孔口尺寸、设计水头和闸门自重快速检索水工金属结构设备资料。",
};

export default function Home() {
  return <GateFinder />;
}
