import type { ProductCode } from "./products";

export type ProductDetail = {
  seoTitle: string;
  audience: string;
  overview: string;
  problems: string[];
  modules: { name: string; description: string }[];
  workflows: { title: string; description: string }[];
  reports: string[];
  onboarding: string[];
  confirmBeforeLive: string[];
  faqs: { question: string; answer: string }[];
};

export const PRODUCT_DETAILS: Record<ProductCode, ProductDetail> = {
  CARE: {
    seoTitle: "Care management software for UK care teams",
    audience: "For domiciliary and community care teams that need care records, visits, medication and oversight in one workspace.",
    overview: "CoreCare Care is designed to replace disconnected rotas, care notes and manager spreadsheets with a clearer daily operating view. The guided demonstration uses representative people and visits, never a customer workspace.",
    problems: ["Care information split across paper, messages and spreadsheets", "Late visibility of missed or changed visits", "Managers spending too long assembling evidence for review"],
    modules: [
      { name: "Care plans and risk", description: "Keep current care information and review activity visible to the people responsible for it." },
      { name: "Rota and live visits", description: "Plan work, follow day-to-day coverage and surface items needing a coordinator’s attention." },
      { name: "Medication and incidents", description: "Record medication activity and incidents in structured workflows with a clearer audit trail." },
      { name: "Family access", description: "Demonstrate a controlled way for approved contacts to see the information made available to them." },
    ],
    workflows: [
      { title: "Plan the day", description: "Coordinators review visits, availability and changes before work begins." },
      { title: "Record care", description: "Authorised staff update visits and care activity from a browser-based workspace." },
      { title: "Review exceptions", description: "Managers focus on overdue, incomplete or escalated work instead of checking every record." },
    ],
    reports: ["Visit coverage and completion", "Care-plan and risk-review readiness", "Medication and incident activity"],
    onboarding: ["Map services, roles and approval responsibilities", "Agree a safe data-migration and validation plan", "Train managers before inviting the wider team", "Run an agreed readiness review before live use"],
    confirmBeforeLive: ["Regulatory and clinical-governance fit", "Migration of existing care and medication records", "Any payroll, rostering, EVV or third-party connections"],
    faqs: [
      { question: "Can we use real care data in the trial?", answer: "The initial trial uses representative data. We agree security, governance and migration arrangements before any real care information is introduced." },
      { question: "Does it replace every care system we use?", answer: "That depends on your service and integrations. We map your current process and confirm the production scope before you commit." },
    ],
  },
  CAMPSITE: {
    seoTitle: "Campsite booking and operations software",
    audience: "For independent campsites and holiday parks that want one clear view of pitches, stays, arrivals and everyday site work.",
    overview: "CoreCare Campsites brings the booking register and the work behind each stay into a single operational view. The guided demonstration uses a representative site so your team can test the flow safely.",
    problems: ["Availability spread across calendars, notebooks and inboxes", "Arrival information that is difficult for the whole team to see", "Manual occupancy and booking summaries"],
    modules: [
      { name: "Booking register", description: "See upcoming, current and past stays with the guest and booking context your team needs." },
      { name: "Pitch and unit availability", description: "Organise accommodation and make gaps, overlaps and planned closures easier to spot." },
      { name: "Arrivals and departures", description: "Give reception and site staff a practical daily list for check-in and turnaround." },
      { name: "Guest and site operations", description: "Keep useful stay notes and day-to-day actions connected to the booking." },
    ],
    workflows: [
      { title: "Review availability", description: "Find suitable dates and units from one shared register." },
      { title: "Prepare arrivals", description: "See who is due, what is outstanding and which pitches or units need attention." },
      { title: "Run the site", description: "Keep booking updates and operational notes available to the people on duty." },
    ],
    reports: ["Occupancy by date and unit type", "Arrival and departure workload", "Booking status and outstanding actions"],
    onboarding: ["Map pitch, unit and season structure", "Agree how existing bookings will be checked and imported", "Configure team access", "Validate availability before opening live use"],
    confirmBeforeLive: ["Online booking and website requirements", "Payment-provider compatibility", "Migration quality and seasonal pricing rules"],
    faqs: [
      { question: "Can you import our current bookings?", answer: "We review the source format and agree a checked migration plan. Import is not assumed until the data has been assessed." },
      { question: "Does it connect to our website and payment provider?", answer: "Those connections depend on your current setup. We confirm compatibility and scope during onboarding." },
    ],
  },
  FINANCE: {
    seoTitle: "Finance workspace for small UK businesses",
    audience: "For small UK organisations that need a clearer view of everyday accounts, invoices, journals and cash position.",
    overview: "CoreCare Finance is an operational finance workspace for keeping records and day-to-day visibility together. Statutory, tax and external accounting requirements are confirmed with you before production use.",
    problems: ["Cash and invoice information held in disconnected files", "Reconciliation work that is hard to review", "Management figures arriving too late for practical decisions"],
    modules: [
      { name: "Accounts and journals", description: "Keep structured entries and supporting context together for review." },
      { name: "Sales and purchase records", description: "Follow invoices, balances and everyday finance activity from a shared workspace." },
      { name: "Cash visibility", description: "Bring current balances and near-term movement into a clearer operating view." },
      { name: "Financial reporting", description: "Produce consistent management views from the records held in the workspace." },
    ],
    workflows: [
      { title: "Record activity", description: "Enter and review everyday transactions using agreed account structures." },
      { title: "Reconcile", description: "Work through unmatched items and keep review status visible." },
      { title: "Understand position", description: "Use current management views to identify exceptions and next actions." },
    ],
    reports: ["Invoice and balance position", "Cash and reconciliation status", "Management account summaries"],
    onboarding: ["Map chart of accounts and user responsibilities", "Assess opening balances and migration sources", "Confirm review and approval workflow", "Validate outputs with your finance adviser before live use"],
    confirmBeforeLive: ["HMRC, tax and statutory-reporting needs", "Bank feeds and external accounting connections", "Treatment of historical records and opening balances"],
    faqs: [
      { question: "Is every tax or statutory submission included?", answer: "No universal claim is made. We confirm your statutory and HMRC requirements before production use." },
      { question: "Can our accountant review it?", answer: "We can demonstrate roles and reporting, then agree the access and outputs your accountant needs." },
    ],
  },
  GARAGE: {
    seoTitle: "Garage and workshop management software",
    audience: "For independent garages and workshops that need the diary, job cards, vehicles, estimates and progress in one place.",
    overview: "CoreCare Garage gives service advisers and technicians a shared view of the work moving through the workshop. The demonstration uses representative customers, vehicles and jobs.",
    problems: ["Diary changes that do not reach the workshop", "Job information split between paper, messages and separate systems", "Customers calling because progress is not easy to see"],
    modules: [
      { name: "Workshop diary", description: "Plan bookings and keep changes visible across reception and workshop teams." },
      { name: "Job cards and inspections", description: "Follow required work, findings and status through a consistent job workflow." },
      { name: "Customers and vehicles", description: "Keep useful customer and vehicle history connected to each booking." },
      { name: "Estimates and reminders", description: "Prepare customer-facing work information and track agreed follow-up actions." },
    ],
    workflows: [
      { title: "Book and prepare", description: "Capture the vehicle, requested work and planned slot before arrival." },
      { title: "Inspect and update", description: "Record findings and keep job progress visible while work is underway." },
      { title: "Complete and follow up", description: "Review the job record, collection status and future reminders." },
    ],
    reports: ["Jobs by workshop status", "Diary and technician workload", "Outstanding estimates and customer actions"],
    onboarding: ["Map bays, services, roles and job stages", "Assess customer and vehicle data for migration", "Configure templates and responsibilities", "Test a complete job from booking to collection"],
    confirmBeforeLive: ["Parts-catalogue and supplier connections", "MOT or other third-party services", "Messaging, payment and accounting integrations"],
    faqs: [
      { question: "Does it connect to MOT, parts and payment systems?", answer: "Compatibility depends on the provider and your workflow. We confirm each external connection before it forms part of the scope." },
      { question: "Can we move customer and vehicle history?", answer: "We first assess the source data, then agree what can be imported and how it will be checked." },
    ],
  },
  POS: {
    seoTitle: "Hospitality POS and kitchen workflow software",
    audience: "For restaurants, bars and hospitality teams that want ordering, menus, tables and kitchen progress in one focused workspace.",
    overview: "CoreCare POS is designed around the pace of service, from entering an order to following its kitchen status. The guided demonstration runs with representative menus and orders; hardware and payment compatibility are confirmed separately.",
    problems: ["Orders and kitchen updates becoming disconnected", "Menu changes taking too long to reach the till", "Limited visibility of open tables, collections and service status"],
    modules: [
      { name: "Touchscreen till", description: "Enter table, takeaway and collection orders through a focused service interface." },
      { name: "Menus and categories", description: "Keep the products offered to the team organised and easier to maintain." },
      { name: "Kitchen workflow", description: "Move orders through clear preparation states so front and back of house share the same view." },
      { name: "Order history", description: "Review recent activity and the operational record associated with each order." },
    ],
    workflows: [
      { title: "Set up service", description: "Review menus, availability and the workspaces needed for the shift." },
      { title: "Take and prepare orders", description: "Keep order details and kitchen status joined up as service moves." },
      { title: "Review the day", description: "Use order and service information to understand activity and exceptions." },
    ],
    reports: ["Orders and sales by period", "Open, preparing and completed orders", "Menu and service activity"],
    onboarding: ["Map service types, menus and user roles", "Confirm devices, network and printing requirements", "Test front-of-house and kitchen flow", "Complete an agreed readiness check before live service"],
    confirmBeforeLive: ["Card-terminal and payment-provider support", "Receipt and kitchen printing hardware", "Accounting, delivery or online-order integrations"],
    faqs: [
      { question: "Will it work with our card terminals and printers?", answer: "Hardware and payment compatibility must be checked against the exact models and providers before installation." },
      { question: "Can we test it without disrupting service?", answer: "Yes. The guided trial uses representative orders and can be reviewed away from your live service." },
    ],
  },
};
