export type ProductCode = "CARE" | "CAMPSITE" | "FINANCE" | "GARAGE" | "POS" | "PLATFORM";

export type CoreCareProduct = {
  code: ProductCode;
  slug: string;
  name: string;
  shortName: string;
  eyebrow: string;
  description: string;
  features: string[];
  accent: string;
  soft: string;
  icon: string;
  liveUrl: string;
  intendedHostname: string;
  trialAvailable: boolean;
  metric: { value: string; label: string; detail: string };
};

export const PRODUCTS: CoreCareProduct[] = [
  { code: "CARE", slug: "care", name: "CoreCare Care", shortName: "Care", eyebrow: "Care management", description: "Bring care plans, rota, eMAR, live visits, incidents and family access into one calm, connected workspace.", features: ["Care plans & risk", "Rota & live visits", "eMAR & family portal"], accent: "#0f766e", soft: "#dff5f1", icon: "CA", liveUrl: "https://corecare-care.cselectricalservices11.workers.dev", intendedHostname: "care.corecaresystems.co.uk", trialAvailable: true, metric: { value: "96%", label: "Visits covered", detail: "12 visits live now" } },
  { code: "CAMPSITE", slug: "campsites", name: "CoreCare Campsites", shortName: "Campsites", eyebrow: "Leisure operations", description: "See bookings, availability, guests and day-to-day site activity without losing the personal touch.", features: ["Booking register", "Pitch availability", "Guest & site operations"], accent: "#247a57", soft: "#e4f4e9", icon: "CS", liveUrl: "https://corecare-campsite.cselectricalservices11.workers.dev", intendedHostname: "campsites.corecaresystems.co.uk", trialAvailable: true, metric: { value: "84%", label: "Weekend occupancy", detail: "8 arrivals today" } },
  { code: "FINANCE", slug: "finance", name: "CoreCare Finance", shortName: "Finance", eyebrow: "Business finance", description: "Keep accounts, journals, cash position and financial reporting visible in a system made for everyday decisions.", features: ["Accounts & journals", "Cashflow visibility", "Financial reporting"], accent: "#2161a8", soft: "#e5eefb", icon: "FI", liveUrl: "https://corecare-finance.cselectricalservices11.workers.dev", intendedHostname: "finance.corecaresystems.co.uk", trialAvailable: true, metric: { value: "£48.2k", label: "Cash available", detail: "+8.4% this month" } },
  { code: "GARAGE", slug: "garage", name: "CoreCare Garage", shortName: "Garage", eyebrow: "Workshop management", description: "Keep the diary moving with joined-up job cards, customers, vehicles, inspections, estimates and reminders.", features: ["Workshop diary", "Jobs & inspections", "Customers & vehicles"], accent: "#b45f2a", soft: "#faeadf", icon: "GA", liveUrl: "https://corecare-garage.cselectricalservices11.workers.dev", intendedHostname: "garage.corecaresystems.co.uk", trialAvailable: true, metric: { value: "14", label: "Jobs in progress", detail: "3 ready to collect" } },
  { code: "POS", slug: "pos", name: "CoreCare POS", shortName: "POS", eyebrow: "Hospitality point of sale", description: "Take orders, manage menus, coordinate the kitchen and keep service flowing from one modern till workspace.", features: ["Touchscreen till", "Kitchen workflow", "Menu & order history"], accent: "#8554a9", soft: "#f0e8f7", icon: "PO", liveUrl: "https://corecare-pos.cselectricalservices11.workers.dev", intendedHostname: "pos.corecaresystems.co.uk", trialAvailable: true, metric: { value: "£1,284", label: "Sales today", detail: "42 orders served" } },
  { code: "PLATFORM", slug: "owner-platform", name: "CoreCare Owner Platform", shortName: "Owner Platform", eyebrow: "CoreCare operations", description: "The protected owner command centre for customers, product health, support, entitlements and commercial oversight.", features: ["Customer overview", "Product health", "Support & entitlements"], accent: "#132c3f", soft: "#e5ebef", icon: "OP", liveUrl: "https://corecare-platform.cselectricalservices11.workers.dev", intendedHostname: "platform.corecaresystems.co.uk", trialAvailable: false, metric: { value: "6", label: "Products connected", detail: "Owner access only" } },
];

export const TRIAL_PRODUCTS = PRODUCTS.filter((product) => product.trialAvailable);
export function getProduct(code: string | null | undefined) { return PRODUCTS.find((product) => product.code === String(code || "").toUpperCase()); }
export function getProductBySlug(slug: string | null | undefined) { return PRODUCTS.find((product) => product.slug === String(slug || "").toLowerCase()); }
