import type { ProductCode } from "./products";

export type ProductRequirements = {
  bestSuitedTo: string[];
  notSuitedTo: string[];
  typicalOrganisation: string;
  devices: string;
  connectivity: string;
  migration: string;
  implementation: string;
  support: string;
  currentLimitations: string[];
  featureStatus: { capability: string; status: "Available to evaluate" | "Confirm before live" | "Not currently offered"; note: string }[];
};

export const PRODUCT_REQUIREMENTS: Record<ProductCode, ProductRequirements> = {
  CARE: {
    bestSuitedTo: ["Domiciliary and community care teams", "Providers replacing fragmented rotas, notes and oversight spreadsheets", "Teams willing to complete a controlled governance and migration review"],
    notSuitedTo: ["Unsupervised use with live care data during the initial trial", "Providers needing an unverified payroll, EVV or third-party integration on day one", "Any service expecting CoreCare to replace professional or statutory judgement"],
    typicalOrganisation: "Small and growing care providers; exact branch, staff and service-user scope is agreed before ordering.",
    devices: "Modern desktop and tablet browsers. Mobile-carer workflow and exact device compatibility must be validated for your use case.",
    connectivity: "A stable internet connection is required. Offline operation is not currently promised.",
    migration: "Structured import may be possible after source assessment, data minimisation and customer-led validation.",
    implementation: "Discovery, representative trial, migration plan, manager training and readiness review. Timing depends on data and governance scope.",
    support: "Guided onboarding and the support route stated in the order; no universal 24-hour service level is claimed.",
    currentLimitations: ["No universal offline mode claim", "Payroll, EVV and external integrations are not assumed", "Clinical and regulatory fit requires customer approval before production"],
    featureStatus: [
      { capability: "Care plans, risk, rota and visit oversight", status: "Available to evaluate", note: "Representative records and workflows are included in the guided evaluation." },
      { capability: "Medication, incidents and family access", status: "Available to evaluate", note: "Configuration and governance remain subject to readiness review." },
      { capability: "GPS/ECM, payroll, invoicing and specialist integrations", status: "Confirm before live", note: "Scope and provider compatibility are not assumed." },
      { capability: "Guaranteed offline carer operation", status: "Not currently offered", note: "A stable connection is required unless an order expressly says otherwise." },
    ],
  },
  CAMPSITE: {
    bestSuitedTo: ["Independent campsites and holiday parks", "Teams needing one booking and arrivals view", "Sites prepared to validate accommodation and booking data before launch"],
    notSuitedTo: ["Sites requiring an unverified channel-manager or payment connection immediately", "Offline-only reception environments", "Organisations expecting automated migration without source checking"],
    typicalOrganisation: "Independent sites and small multi-site operators; pitch, unit and seasonal complexity is scoped before ordering.",
    devices: "Modern desktop and tablet browsers; phone access is possible but reception workflows should be tested on the intended devices.",
    connectivity: "A stable internet connection is required. Offline booking operation is not currently promised.",
    migration: "Existing booking imports are assessed, mapped and reconciled before production use.",
    implementation: "Site-structure mapping, migration validation, role setup and availability reconciliation. Timing follows the number and quality of records.",
    support: "Guided setup and the support arrangement stated in the order.",
    currentLimitations: ["Website booking, channel and payment integrations require compatibility checks", "No universal offline mode claim", "Seasonal pricing rules are agreed before production"],
    featureStatus: [
      { capability: "Booking register, availability and arrivals", status: "Available to evaluate", note: "Representative site data is included in the guided evaluation." },
      { capability: "Guest and day-to-day site operations", status: "Available to evaluate", note: "The final setup follows the site’s own workflow." },
      { capability: "Online booking, payment and channel connections", status: "Confirm before live", note: "Compatibility depends on the customer’s providers." },
      { capability: "Guaranteed offline reception operation", status: "Not currently offered", note: "A stable connection is required." },
    ],
  },
  FINANCE: {
    bestSuitedTo: ["Small UK organisations wanting clearer day-to-day finance records", "Teams working with an accountant or finance adviser", "Businesses prepared to validate opening balances and outputs"],
    notSuitedTo: ["Use as assumed tax, legal or accounting advice", "Businesses requiring an unverified HMRC submission or bank feed immediately", "Offline-only bookkeeping"],
    typicalOrganisation: "Sole traders and small organisations; entities, users, transaction volume and reporting needs are agreed before ordering.",
    devices: "Modern desktop and tablet browsers. Desktop use is recommended for detailed finance review.",
    connectivity: "A stable internet connection is required. Offline accounting operation is not currently promised.",
    migration: "Opening balances and historical records are assessed, mapped and reconciled with the customer or adviser.",
    implementation: "Chart-of-accounts review, access setup, opening-data validation and output sign-off. Timing depends on record quality and statutory scope.",
    support: "Product support and implementation assistance as stated in the order; professional accounting advice is not included.",
    currentLimitations: ["No universal HMRC filing or bank-feed claim", "No substitute for professional advice", "Historical migration and statutory outputs require validation"],
    featureStatus: [
      { capability: "Accounts, journals, invoices and cash visibility", status: "Available to evaluate", note: "Representative financial data is included in the guided evaluation." },
      { capability: "Management reporting and reconciliation", status: "Available to evaluate", note: "Outputs must be checked against the organisation’s requirements." },
      { capability: "HMRC submissions, bank feeds and external accounting links", status: "Confirm before live", note: "No universal connection is claimed." },
      { capability: "Professional accounting or tax advice", status: "Not currently offered", note: "Customers remain responsible for appropriate professional review." },
    ],
  },
  GARAGE: {
    bestSuitedTo: ["Independent garages and workshops", "Reception and technician teams sharing job progress", "Businesses replacing disconnected diaries and job records"],
    notSuitedTo: ["Workshops requiring an unverified MOT or parts integration immediately", "Offline-only operation", "Businesses expecting automated migration without checking customer and vehicle data"],
    typicalOrganisation: "Independent garages and small workshop groups; locations, users, bays and integrations are scoped before ordering.",
    devices: "Modern desktop and tablet browsers; exact workshop-device suitability should be tested around the working environment.",
    connectivity: "A stable internet connection is required. Offline workshop operation is not currently promised.",
    migration: "Customer, vehicle and job-history imports are assessed and validated before live use.",
    implementation: "Workflow mapping, templates, role setup, migration and a complete booking-to-collection test. Timing depends on data and integrations.",
    support: "Guided setup and product support as stated in the order.",
    currentLimitations: ["MOT, parts, messaging and payment integrations are not assumed", "No universal offline mode claim", "Hardware and supplier compatibility requires confirmation"],
    featureStatus: [
      { capability: "Diary, job cards, inspections and estimates", status: "Available to evaluate", note: "Representative customers, vehicles and jobs are included." },
      { capability: "Customer and vehicle history", status: "Available to evaluate", note: "Migration quality is checked before production." },
      { capability: "MOT, parts, messaging, payments and accounts", status: "Confirm before live", note: "Each provider and workflow must be scoped." },
      { capability: "Guaranteed offline workshop operation", status: "Not currently offered", note: "A stable connection is required." },
    ],
  },
  POS: {
    bestSuitedTo: ["Independent pubs, restaurants and hospitality venues", "Teams needing joined-up till and kitchen progress", "Venues able to test exact hardware before installation"],
    notSuitedTo: ["Immediate deployment with unverified card terminals or printers", "Service environments without a reliable network", "Multi-location rollouts before a controlled site pilot"],
    typicalOrganisation: "Independent hospitality venues and small groups; sites, tills, kitchen stations and order volume are agreed before ordering.",
    devices: "Modern touch-capable desktop and tablet browsers. Exact till, printer and kitchen-display hardware must be tested.",
    connectivity: "A stable local network and internet connection are required. Offline trading is not currently promised.",
    migration: "Menu and catalogue setup can be mapped from a structured source after review; historical transaction migration is scoped separately.",
    implementation: "Menu setup, role configuration, hardware checks and a full front-to-back service rehearsal. Timing depends on venue and equipment.",
    support: "Guided installation and product support as stated in the order; out-of-hours cover is not universal.",
    currentLimitations: ["Card terminals, printers and delivery integrations require exact compatibility checks", "No universal offline trading claim", "Multi-site production rollout follows a controlled readiness review"],
    featureStatus: [
      { capability: "Till, menus, orders and kitchen workflow", status: "Available to evaluate", note: "Representative menus and orders are included." },
      { capability: "Order history and operational sales views", status: "Available to evaluate", note: "Final reporting follows the agreed setup." },
      { capability: "Card terminals, printing, delivery and accounting links", status: "Confirm before live", note: "Exact devices and providers must be tested." },
      { capability: "Guaranteed offline trading", status: "Not currently offered", note: "Network and internet resilience remain customer readiness requirements." },
    ],
  },
};
