import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/login", "/trial/status"] }, sitemap: "https://www.corecaresystems.co.uk/sitemap.xml", host: "https://www.corecaresystems.co.uk" };
}
