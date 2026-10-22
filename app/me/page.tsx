import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { AboutMount } from "@/app/me/AboutMount";
import { site } from "@/lib/site";
import "./about.css";

export const metadata: Metadata = {
  title: "关于我",
  description:
    "90 年生，安徽农村长大的大专生，2011 年来上海做前端。现在是居家的非典型家庭主夫、九年新能源车主、跑了五千多公里的业余跑者。",
  alternates: { canonical: "/me" },
  openGraph: {
    title: `关于我｜${site.name}`,
    description: site.description,
  },
};

export default function AboutPage() {
  const dir = path.join(process.cwd(), "content", "about");
  const html = fs.readFileSync(path.join(dir, "main.html"), "utf8");
  const script = fs.readFileSync(path.join(dir, "boot.js"), "utf8");
  return <AboutMount html={html} script={script} />;
}
