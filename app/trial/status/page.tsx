import type { Metadata } from "next";
import StatusClient from "./status-client";

export const metadata: Metadata = { title: "Trial status", robots: { index: false, follow: false } };

export default async function TrialStatusPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { return <StatusClient token={(await searchParams).token || ""} />; }
