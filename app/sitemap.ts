import type { MetadataRoute } from "next";
import { CUSTOMER_PRODUCTS } from "./products";
import { SOLUTIONS } from "./solutions-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.corecaresystems.co.uk";
  const pages = ["", "/solutions", "/demos", "/trial", "/plans", "/product-status", "/about", "/status", "/support", "/account-help", "/security", "/compliance", "/privacy", "/data-rights", "/data-processing-agreement", "/customer-terms", "/data-retention", "/subprocessors", "/cookies", "/terms", "/legal", "/contact"];
  return [...pages.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-08-05"), changeFrequency: path === "" || path === "/status" ? "daily" as const : "monthly" as const, priority: path === "" ? 1 : 0.7 })), ...CUSTOMER_PRODUCTS.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date("2026-08-05"), changeFrequency: "monthly" as const, priority: 0.8 })), ...SOLUTIONS.map((solution) => ({ url: `${base}/solutions/${solution.slug}`, lastModified: new Date("2026-08-05"), changeFrequency: "monthly" as const, priority: 0.75 }))];
}
