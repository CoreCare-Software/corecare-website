import type { MetadataRoute } from "next";
import { CUSTOMER_PRODUCTS } from "./products";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.corecaresystems.co.uk";
  const pages = ["", "/trial", "/plans", "/support", "/account-help", "/security", "/compliance", "/privacy", "/data-rights", "/data-processing-agreement", "/customer-terms", "/data-retention", "/subprocessors", "/cookies", "/terms", "/legal", "/contact"];
  return [...pages.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-08-05"), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : 0.7 })), ...CUSTOMER_PRODUCTS.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date("2026-08-05"), changeFrequency: "monthly" as const, priority: 0.8 }))];
}
