import type { Metadata } from "next";
import AccountHelpClient from "./account-help-client";

export const metadata: Metadata = {
  title: "Account and password help",
  description: "Request secure help with access to a CoreCare customer product.",
  alternates: { canonical: "/account-help" },
};

export default function AccountHelpPage() { return <AccountHelpClient />; }
