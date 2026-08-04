import type { Metadata } from "next";
import TrialClient from "./trial-client";

export const metadata: Metadata = { title: "30-day free trial", description: "Request a 30-day CoreCare product trial with no payment card required.", alternates: { canonical: "/trial" } };

export default async function TrialPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  return <TrialClient initialProduct={(await searchParams).product || ""} />;
}
