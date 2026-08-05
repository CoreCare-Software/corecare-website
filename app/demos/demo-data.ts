import type { ProductCode } from "../products";

export type DemoTone = "good" | "attention" | "neutral";

export type DemoView = {
  label: string;
  title: string;
  description: string;
  action: string;
  metrics: { label: string; value: string; detail: string }[];
  boardTitle: string;
  boardHint: string;
  rows: { title: string; meta: string; status: string; tone: DemoTone }[];
  activityTitle: string;
  activity: { time: string; title: string; detail: string }[];
};

export type ProductDemo = {
  code: ProductCode;
  promise: string;
  audience: string;
  nav: string[];
  capabilities: { title: string; detail: string }[];
  views: DemoView[];
};

export const PRODUCT_DEMOS: Record<ProductCode, ProductDemo> = {
  CARE: {
    code: "CARE",
    promise: "Plan, deliver and evidence person-centred care from one calm workspace.",
    audience: "A representative day for a care coordinator, senior carer and registered manager.",
    nav: ["Overview", "People", "Rota", "eMAR", "Incidents", "Reports"],
    capabilities: [
      { title: "Care plans and risk", detail: "Keep outcomes, preferences, assessments and reviews connected to the person." },
      { title: "Rota and live visits", detail: "See coverage, arrivals, late visits and handovers as the day changes." },
      { title: "eMAR and evidence", detail: "Record due medication and retain a clear, attributable administration history." },
      { title: "Incidents and oversight", detail: "Route concerns for review and preserve the actions, decisions and audit trail." },
    ],
    views: [
      {
        label: "Plan the day", title: "Morning coordination", description: "Start with coverage, upcoming visits and the people who need attention.", action: "Add visit",
        metrics: [{ label: "Visits covered", value: "96%", detail: "2 gaps to resolve" }, { label: "Due this hour", value: "12", detail: "Across 4 care teams" }, { label: "Reviews due", value: "3", detail: "Prioritised by risk" }],
        boardTitle: "Live visit board", boardHint: "Updated 09:42",
        rows: [{ title: "Elsie Bennett · Morning care", meta: "09:30 · Emma R. arrived", status: "In progress", tone: "good" }, { title: "James Thompson · Breakfast visit", meta: "09:45 · Cover required", status: "Needs cover", tone: "attention" }, { title: "Margaret Ellis · Wellbeing call", meta: "10:15 · Priya S.", status: "Scheduled", tone: "neutral" }],
        activityTitle: "Coordinator actions", activity: [{ time: "09:40", title: "Cover request sent", detail: "North team · 2 available carers" }, { time: "09:31", title: "Visit started", detail: "Elsie Bennett · Emma R." }, { time: "09:18", title: "Handover acknowledged", detail: "Night team to day team" }],
      },
      {
        label: "Deliver care", title: "Medication and care tasks", description: "Bring the person’s plan, due work and medication record into the visit.", action: "Record outcome",
        metrics: [{ label: "Medication due", value: "8", detail: "Next 30 minutes" }, { label: "Completed safely", value: "31", detail: "Today" }, { label: "Exceptions", value: "1", detail: "Awaiting review" }],
        boardTitle: "eMAR round", boardHint: "Oak Wing · 10:00",
        rows: [{ title: "Amlodipine 5mg · Elsie Bennett", meta: "One tablet · oral", status: "Administered", tone: "good" }, { title: "Paracetamol 500mg · Robert King", meta: "Two tablets · PRN", status: "Effect review", tone: "attention" }, { title: "Vitamin D · Margaret Ellis", meta: "One capsule · oral", status: "Due 10:15", tone: "neutral" }],
        activityTitle: "Visit evidence", activity: [{ time: "10:08", title: "Medication signed", detail: "Emma R. · mobile device" }, { time: "10:04", title: "Fluid chart updated", detail: "250ml recorded" }, { time: "09:58", title: "Care plan opened", detail: "Current version acknowledged" }],
      },
      {
        label: "Review and respond", title: "Manager oversight", description: "Review exceptions, incidents and expiring plans without losing the underlying evidence.", action: "Open review",
        metrics: [{ label: "Open incidents", value: "2", detail: "One high priority" }, { label: "Plans current", value: "94%", detail: "3 reviews due" }, { label: "Actions complete", value: "18/21", detail: "This week" }],
        boardTitle: "Review queue", boardHint: "Ordered by priority",
        rows: [{ title: "Unwitnessed fall · Robert King", meta: "Logged 08:46 · immediate actions complete", status: "Manager review", tone: "attention" }, { title: "Care plan review · J. Thompson", meta: "Mobility and falls risk", status: "Ready", tone: "neutral" }, { title: "Medication exception · Oak Wing", meta: "Outcome follow-up recorded", status: "Closed", tone: "good" }],
        activityTitle: "Audit trail", activity: [{ time: "10:22", title: "Review assigned", detail: "Registered manager" }, { time: "10:14", title: "Relative updated", detail: "Contact note recorded" }, { time: "09:51", title: "Risk score amended", detail: "Previous value retained" }],
      },
    ],
  },
  CAMPSITE: {
    code: "CAMPSITE",
    promise: "Keep availability, guests and site operations moving together from enquiry to departure.",
    audience: "A representative day for reception, site operations and the business owner.",
    nav: ["Dashboard", "Bookings", "Availability", "Guests", "Site tasks", "Reports"],
    capabilities: [
      { title: "Booking register", detail: "Keep guest, stay, balance and booking status in one searchable record." },
      { title: "Pitch availability", detail: "Understand occupancy and spot workable options across dates and unit types." },
      { title: "Arrival operations", detail: "Coordinate check-in, preparation, notes and outstanding guest actions." },
      { title: "Site reporting", detail: "Review occupancy, booking sources, balances and operational workload." },
    ],
    views: [
      {
        label: "Check availability", title: "Seven-day pitch view", description: "See what is occupied, held, available or awaiting confirmation across the site.", action: "New booking",
        metrics: [{ label: "Weekend occupancy", value: "84%", detail: "6 units available" }, { label: "New enquiries", value: "7", detail: "Today" }, { label: "Balances due", value: "£684", detail: "Before arrival" }],
        boardTitle: "Availability and bookings", boardHint: "Fri 14 – Thu 20 Aug",
        rows: [{ title: "Meadow 12 · Harris family", meta: "4 nights · electric grass pitch", status: "Confirmed", tone: "good" }, { title: "Lakeview 4 · Direct enquiry", meta: "3 nights · £164 balance", status: "Held 2h", tone: "attention" }, { title: "Willow Pod · M. Carter", meta: "Checking out Monday", status: "On site", tone: "neutral" }],
        activityTitle: "Booking activity", activity: [{ time: "10:16", title: "Deposit received", detail: "Booking CC-1048" }, { time: "09:54", title: "Availability hold", detail: "Lakeview 4 · expires 11:54" }, { time: "09:21", title: "Stay extended", detail: "Willow Pod · one night" }],
      },
      {
        label: "Run arrivals", title: "Today’s guest journey", description: "Bring preparation, balances and guest notes into one arrival list.", action: "Check in guest",
        metrics: [{ label: "Arrivals today", value: "8", detail: "3 ready now" }, { label: "Departures", value: "5", detail: "2 checked out" }, { label: "Site tasks", value: "11", detail: "7 complete" }],
        boardTitle: "Arrival register", boardHint: "Saturday · reception view",
        rows: [{ title: "Harris family · Meadow 12", meta: "ETA 13:30 · balance paid", status: "Ready", tone: "good" }, { title: "M. Ahmed · Woodland 6", meta: "ETA 15:00 · vehicle note", status: "Review note", tone: "attention" }, { title: "S. Price · Lakeview 2", meta: "ETA 16:45 · 2 adults", status: "Preparing", tone: "neutral" }],
        activityTitle: "Site preparation", activity: [{ time: "10:32", title: "Pitch checked", detail: "Meadow 12 · Lee" }, { time: "10:05", title: "Welcome message sent", detail: "All confirmed arrivals" }, { time: "09:47", title: "Late departure agreed", detail: "Woodland 3 · 12:30" }],
      },
      {
        label: "Review the season", title: "Occupancy and performance", description: "Use live booking records to understand demand and the work ahead.", action: "Export report",
        metrics: [{ label: "August occupancy", value: "78%", detail: "+9% year on year" }, { label: "Direct bookings", value: "64%", detail: "Best source" }, { label: "Average stay", value: "3.8", detail: "Nights" }],
        boardTitle: "Forward position", boardHint: "Next 30 days",
        rows: [{ title: "Electric grass pitches", meta: "83% occupied · 124 nights", status: "+11%", tone: "good" }, { title: "Glamping pods", meta: "91% occupied · 54 nights", status: "Strong", tone: "good" }, { title: "Hardstanding pitches", meta: "66% occupied · 79 nights", status: "Opportunity", tone: "attention" }],
        activityTitle: "Owner insights", activity: [{ time: "Today", title: "Bank holiday nearly full", detail: "Two suitable units remain" }, { time: "7 days", title: "12 balances due", detail: "Automated reminder list ready" }, { time: "30 days", title: "Autumn demand softer", detail: "Review seasonal offer" }],
      },
    ],
  },
  FINANCE: {
    code: "FINANCE",
    promise: "Turn everyday bookkeeping into a clear, reviewable view of cash and performance.",
    audience: "A representative workflow for the business owner, bookkeeper and finance adviser.",
    nav: ["Overview", "Sales", "Purchases", "Banking", "Journals", "Reports"],
    capabilities: [
      { title: "Sales and purchases", detail: "Track invoices, balances, due dates and the source records behind them." },
      { title: "Bank reconciliation", detail: "Work through suggested matches and retain the decision trail." },
      { title: "Journals and controls", detail: "Create structured entries with clear status, notes and review ownership." },
      { title: "Management reporting", detail: "Bring cash, profit and outstanding actions into timely operating views." },
    ],
    views: [
      {
        label: "See the position", title: "Finance overview", description: "Begin with cash, money due and the exceptions that need a decision.", action: "New transaction",
        metrics: [{ label: "Cash available", value: "£48.2k", detail: "+8.4% this month" }, { label: "Receivables", value: "£12.8k", detail: "£2.1k overdue" }, { label: "Bills due", value: "£6.4k", detail: "Next 14 days" }],
        boardTitle: "Priority finance actions", boardHint: "As at 5 August",
        rows: [{ title: "Sales invoices", meta: "18 awaiting payment", status: "£12,840", tone: "neutral" }, { title: "Overdue customer balances", meta: "4 accounts · oldest 21 days", status: "Follow up", tone: "attention" }, { title: "Current account", meta: "Statement position reconciled", status: "Up to date", tone: "good" }],
        activityTitle: "Recent entries", activity: [{ time: "10:12", title: "Payment allocated", detail: "INV-1044 · £1,240" }, { time: "09:48", title: "Purchase recorded", detail: "Northline Supplies · £386" }, { time: "09:21", title: "Journal approved", detail: "Month-end accrual" }],
      },
      {
        label: "Reconcile the bank", title: "Match and explain", description: "Review suggestions, split complex payments and leave unmatched items visible.", action: "Add bank rule",
        metrics: [{ label: "Matched today", value: "24", detail: "£8,914 total" }, { label: "To review", value: "6", detail: "Suggested matches" }, { label: "Unexplained", value: "2", detail: "Need an owner" }],
        boardTitle: "Bank reconciliation", boardHint: "Business current account",
        rows: [{ title: "CORECARE CUSTOMER LTD", meta: "Receipt · 4 Aug · £1,240", status: "95% match", tone: "good" }, { title: "CARD PURCHASE 0471", meta: "Payment · 4 Aug · £86.40", status: "Choose category", tone: "attention" }, { title: "NORTHLINE SUPPLIES", meta: "Payment · 3 Aug · £386", status: "Matched", tone: "good" }],
        activityTitle: "Reconciliation trail", activity: [{ time: "10:20", title: "Invoice match confirmed", detail: "Alex R. · INV-1044" }, { time: "10:06", title: "Payment split", detail: "Fuel and workshop supplies" }, { time: "09:43", title: "Statement imported", detail: "42 new lines" }],
      },
      {
        label: "Review performance", title: "Management reporting", description: "Move from the ledger into a concise view of movement, margin and risk.", action: "Create report pack",
        metrics: [{ label: "Revenue MTD", value: "£31.6k", detail: "+12% vs plan" }, { label: "Gross margin", value: "41.8%", detail: "+1.6 points" }, { label: "Runway", value: "4.7 mo", detail: "At current spend" }],
        boardTitle: "Performance summary", boardHint: "Month to date",
        rows: [{ title: "Recurring product income", meta: "73 active subscriptions", status: "+14%", tone: "good" }, { title: "Implementation income", meta: "6 projects recognised", status: "On plan", tone: "good" }, { title: "Hosting and infrastructure", meta: "Higher usage this month", status: "Review", tone: "attention" }],
        activityTitle: "Review notes", activity: [{ time: "Today", title: "Month-end pack ready", detail: "Three schedules attached" }, { time: "Yesterday", title: "Forecast refreshed", detail: "Updated subscription growth" }, { time: "31 Jul", title: "Period locked", detail: "No unapproved journals" }],
      },
    ],
  },
  GARAGE: {
    code: "GARAGE",
    promise: "Keep reception, technicians and customers aligned from booking to collection.",
    audience: "A representative workflow for a service adviser, technician and workshop manager.",
    nav: ["Workshop", "Diary", "Jobs", "Customers", "Vehicles", "Reports"],
    capabilities: [
      { title: "Workshop diary", detail: "Plan bays, technicians, arrival times and expected workload." },
      { title: "Digital job cards", detail: "Keep requested work, findings, labour, parts and authorisation together." },
      { title: "Vehicle history", detail: "Connect the current job with useful customer, vehicle and service context." },
      { title: "Estimates and follow-up", detail: "Track work awaiting approval, collection and future reminders." },
    ],
    views: [
      {
        label: "Plan the workshop", title: "Today’s diary", description: "Balance promised times, bay capacity and technician workload before the rush starts.", action: "Book vehicle",
        metrics: [{ label: "Jobs today", value: "18", detail: "14 confirmed" }, { label: "Bay utilisation", value: "82%", detail: "One slot available" }, { label: "Due by noon", value: "6", detail: "Two in progress" }],
        boardTitle: "Workshop schedule", boardHint: "Wednesday · all bays",
        rows: [{ title: "AB12 CDE · Full service", meta: "Bay 2 · Liam · due 12:00", status: "In progress", tone: "good" }, { title: "EF34 GHI · MOT", meta: "Bay 1 · Maya · due 11:15", status: "Inspection", tone: "neutral" }, { title: "JK56 LMN · Brake concern", meta: "Awaiting technician · due 15:00", status: "At risk", tone: "attention" }],
        activityTitle: "Reception updates", activity: [{ time: "10:18", title: "Vehicle checked in", detail: "PQ18 RST · keys received" }, { time: "10:02", title: "Customer ETA updated", detail: "AB12 CDE · collection 12:30" }, { time: "09:36", title: "Bay reassigned", detail: "MOT moved to Bay 1" }],
      },
      {
        label: "Run the job", title: "Inspection and authorisation", description: "Give the technician a clear job card and reception a live view of findings.", action: "Add finding",
        metrics: [{ label: "Jobs in progress", value: "14", detail: "Across 5 bays" }, { label: "Awaiting approval", value: "3", detail: "£684 estimated" }, { label: "Parts ready", value: "9", detail: "Two just received" }],
        boardTitle: "Digital job card · AB12 CDE", boardHint: "Ford Focus · 48,214 miles",
        rows: [{ title: "Engine oil and filter", meta: "Service schedule item", status: "Complete", tone: "good" }, { title: "Front brake pads", meta: "3mm remaining · photo attached", status: "Authorised", tone: "good" }, { title: "Nearside tyre", meta: "Advisory · 2.6mm", status: "Customer decision", tone: "attention" }],
        activityTitle: "Job timeline", activity: [{ time: "10:24", title: "Work authorised", detail: "Front pads · SMS response" }, { time: "10:11", title: "Inspection shared", detail: "Three findings sent" }, { time: "09:52", title: "Job started", detail: "Liam · Bay 2" }],
      },
      {
        label: "Complete and follow up", title: "Ready for collection", description: "Check completion, explain work and keep future actions from disappearing.", action: "Mark collected",
        metrics: [{ label: "Ready to collect", value: "3", detail: "£1,142 total" }, { label: "Completed today", value: "8", detail: "96% on time" }, { label: "Reminders created", value: "11", detail: "MOT and service" }],
        boardTitle: "Collection queue", boardHint: "Customer communication view",
        rows: [{ title: "CD23 XYZ · Annual service", meta: "Invoice ready · customer notified", status: "Ready", tone: "good" }, { title: "MN17 QRS · Diagnostic", meta: "Report attached · call requested", status: "Explain findings", tone: "attention" }, { title: "UV66 KLP · Tyre replacement", meta: "Paid online · keys at reception", status: "Collecting", tone: "neutral" }],
        activityTitle: "Customer contact", activity: [{ time: "14:08", title: "Ready message delivered", detail: "CD23 XYZ" }, { time: "13:52", title: "Invoice approved", detail: "MN17 QRS · £148" }, { time: "13:35", title: "MOT reminder scheduled", detail: "UV66 KLP · 11 months" }],
      },
    ],
  },
  POS: {
    code: "POS",
    promise: "Connect ordering, kitchen progress and service oversight in one fast hospitality workspace.",
    audience: "A representative service for front of house, kitchen and the duty manager.",
    nav: ["Till", "Tables", "Kitchen", "Menu", "Orders", "Reports"],
    capabilities: [
      { title: "Touch-first ordering", detail: "Build table, takeaway and collection orders through a focused till flow." },
      { title: "Menu control", detail: "Organise items, options, availability and service categories centrally." },
      { title: "Kitchen workflow", detail: "Move tickets through received, preparing and ready states." },
      { title: "Service reporting", detail: "Review orders, sales, exceptions and product activity by period." },
    ],
    views: [
      {
        label: "Take the order", title: "Fast till workspace", description: "Keep products, options, table context and the running total clear during service.", action: "Send order",
        metrics: [{ label: "Open tables", value: "9", detail: "26 covers" }, { label: "Sales today", value: "£1,284", detail: "42 orders" }, { label: "Average ticket", value: "£30.57", detail: "+£2.14" }],
        boardTitle: "Table 12 · 4 covers", boardHint: "Order #1048",
        rows: [{ title: "2 × CoreCare Burger", meta: "One no onion · fries", status: "£25.00", tone: "neutral" }, { title: "1 × Garden Bowl", meta: "Add halloumi", status: "£13.50", tone: "neutral" }, { title: "Drinks", meta: "2 cola · 1 sparkling water", status: "£8.20", tone: "good" }],
        activityTitle: "Order summary", activity: [{ time: "Total", title: "£46.70", detail: "VAT included" }, { time: "Course", title: "Mains together", detail: "Send to kitchen" }, { time: "Note", title: "Allergy check complete", detail: "Server acknowledgement" }],
      },
      {
        label: "Run the kitchen", title: "Kitchen display", description: "Prioritise new tickets, preparation time and orders ready for service.", action: "Bump ticket",
        metrics: [{ label: "Cooking", value: "8", detail: "3 due soon" }, { label: "Average time", value: "11m", detail: "Target under 14m" }, { label: "Ready", value: "3", detail: "Awaiting collection" }],
        boardTitle: "Live kitchen tickets", boardHint: "Mains · oldest first",
        rows: [{ title: "Table 12 · 4 items", meta: "8 min · allergy note", status: "Cooking", tone: "attention" }, { title: "Collection #1042 · 2 items", meta: "11 min · paid", status: "Ready", tone: "good" }, { title: "Table 7 · 2 items", meta: "3 min · starters", status: "Received", tone: "neutral" }],
        activityTitle: "Kitchen pace", activity: [{ time: "10m", title: "Table 9 completed", detail: "Within target" }, { time: "8m", title: "Table 12 cooking", detail: "One flagged item" }, { time: "3m", title: "Table 7 received", detail: "Two starters" }],
      },
      {
        label: "Review service", title: "Duty manager view", description: "Understand sales, table flow, voids and the items shaping the shift.", action: "Close shift",
        metrics: [{ label: "Net sales", value: "£3,842", detail: "+7% vs last Wed" }, { label: "Orders served", value: "126", detail: "94 dine-in" }, { label: "Voids", value: "0.8%", detail: "Within threshold" }],
        boardTitle: "Service performance", boardHint: "Lunch and evening",
        rows: [{ title: "Food sales", meta: "74% of revenue", status: "£2,843", tone: "good" }, { title: "Drinks sales", meta: "26% of revenue", status: "£999", tone: "neutral" }, { title: "Late tickets", meta: "4 exceeded 18 minutes", status: "Review", tone: "attention" }],
        activityTitle: "Manager checks", activity: [{ time: "22:34", title: "Till counts entered", detail: "Two terminals" }, { time: "22:26", title: "Open tables cleared", detail: "No unsettled orders" }, { time: "22:18", title: "Void report reviewed", detail: "Four authorised entries" }],
      },
    ],
  },
};
