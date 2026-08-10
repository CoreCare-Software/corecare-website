export type ProductCode = "CARE" | "CAMPSITE" | "FINANCE" | "GARAGE" | "POS";

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
  availability: string;
  availabilityDetail: string;
  metric: { value: string; label: string; detail: string };
};

export const PRODUCTS: CoreCareProduct[] = [
  {
    code: "CARE", slug: "care", name: "CoreCare Care", shortName: "Care", eyebrow: "Care management",
    description: "Bring care plans, rota, eMAR, live visits, incidents and family access into one calm, connected workspace.",
    features: ["Care plans & risk", "Rota & live visits", "eMAR & family portal"], accent: "#0f766e", soft: "#dff5f1", icon: "CA",
    liveUrl: "https://care.corecaresystems.co.uk", intendedHostname: "care.corecaresystems.co.uk", trialAvailable: true,
    availability: "Guided evaluation", availabilityDetail: "Representative workflows are available to evaluate now. This status does not mean unrestricted production approval; care governance, migration and readiness must be agreed before live use.",
    metric: { value: "96%", label: "Visits covered", detail: "12 visits live now" },
  },
  {
    code: "CAMPSITE", slug: "campsites", name: "CoreCare Campsites", shortName: "Campsites", eyebrow: "Leisure operations",
    description: "See bookings, availability, guests and day-to-day site activity without losing the personal touch.",
    features: ["Booking register", "Pitch availability", "Guest & site operations"], accent: "#247a57", soft: "#e4f4e9", icon: "CS",
    liveUrl: "https://campsites.corecaresystems.co.uk", intendedHostname: "campsites.corecaresystems.co.uk", trialAvailable: true,
    availability: "Guided evaluation", availabilityDetail: "Representative booking and site-management workflows are available to evaluate now. Your site structure, migration and production readiness must be agreed before live use.",
    metric: { value: "84%", label: "Weekend occupancy", detail: "8 arrivals today" },
  },
  {
    code: "FINANCE", slug: "finance", name: "CoreCare Finance", shortName: "Finance", eyebrow: "Business finance",
    description: "Keep accounts, journals, cash position and financial reporting visible in a system made for everyday decisions.",
    features: ["Accounts & journals", "Cashflow visibility", "Financial reporting"], accent: "#2161a8", soft: "#e5eefb", icon: "FI",
    liveUrl: "https://finance.corecaresystems.co.uk", intendedHostname: "finance.corecaresystems.co.uk", trialAvailable: true,
    availability: "Guided evaluation", availabilityDetail: "Representative finance workflows are available to evaluate now. Tax, bank-feed, accounting, statutory reporting and production readiness must be agreed before live use.",
    metric: { value: "£48.2k", label: "Cash available", detail: "+8.4% this month" },
  },
  {
    code: "GARAGE", slug: "garage", name: "CoreCare Garage", shortName: "Garage", eyebrow: "Workshop management",
    description: "Keep the diary moving with joined-up job cards, customers, vehicles, inspections, estimates and reminders.",
    features: ["Workshop diary", "Jobs & inspections", "Customers & vehicles"], accent: "#8f451f", soft: "#faeadf", icon: "GA",
    liveUrl: "https://garage.corecaresystems.co.uk", intendedHostname: "garage.corecaresystems.co.uk", trialAvailable: true,
    availability: "Guided evaluation", availabilityDetail: "Representative workshop workflows are available to evaluate now. Parts, MOT, messaging, payment integrations and production readiness must be agreed before live use.",
    metric: { value: "14", label: "Jobs in progress", detail: "3 ready to collect" },
  },
  {
    code: "POS", slug: "pos", name: "CoreCare POS", shortName: "POS", eyebrow: "Hospitality point of sale",
    description: "Take orders, manage menus, coordinate the kitchen and keep service flowing from one modern till workspace.",
    features: ["Touchscreen till", "Kitchen workflow", "Menu & order history"], accent: "#8554a9", soft: "#f0e8f7", icon: "PO",
    liveUrl: "https://pos.corecaresystems.co.uk", intendedHostname: "pos.corecaresystems.co.uk", trialAvailable: true,
    availability: "Guided evaluation", availabilityDetail: "Representative till and kitchen workflows are available to evaluate now. Hardware, network, card-terminal and payment-provider compatibility must be agreed before installation or live use.",
    metric: { value: "£1,284", label: "Sales today", detail: "42 orders served" },
  },
];

export const CUSTOMER_PRODUCTS = PRODUCTS;
export const TRIAL_PRODUCTS = CUSTOMER_PRODUCTS.filter((product) => product.trialAvailable);
export function getProduct(code: string | null | undefined) { return PRODUCTS.find((product) => product.code === String(code || "").toUpperCase()); }
export function getProductBySlug(slug: string | null | undefined) { return PRODUCTS.find((product) => product.slug === String(slug || "").toLowerCase()); }
