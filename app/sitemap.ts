import type { MetadataRoute } from "next";
import { PRODUCTS } from "./products";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.corecaresystems.co.uk";
  const pages = ["", "/trial", "/plans", "/security", "/privacy", "/cookies", "/terms", "/contact"];
  return [...pages.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-08-04"), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : 0.7 })), ...PRODUCTS.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date("2026-08-04"), changeFrequency: "monthly" as const, priority: 0.8 }))];
}
