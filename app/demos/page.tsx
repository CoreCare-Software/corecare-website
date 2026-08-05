import type { Metadata } from "next";
import { MarketingShell } from "../site-chrome";
import DemoClient from "./demo-client";

export const metadata: Metadata = {
  title: "Interactive product demonstrations",
  description: "Explore representative visual workflows for CoreCare Care, Campsites, Finance, Garage and POS.",
  alternates: { canonical: "/demos" },
  openGraph: { title: "Explore every CoreCare product", description: "Interactive representative workflows across the complete CoreCare software suite.", url: "/demos" },
};

export default function DemosPage() {
  return <MarketingShell><section className="content-hero visual-demo-hero"><div className="site-shell"><p className="eyebrow">Interactive product demonstrations</p><h1>See every customer product in action.</h1><p className="content-lead">Choose a product, move through its key workflow and see the operational capabilities it brings together. Every record shown is fictional and representative.</p><div className="demo-hero-proof"><span><i>✓</i> Five visual demonstrations</span><span><i>✓</i> Realistic fictional data</span><span><i>✓</i> Works on desktop and mobile</span></div></div></section><section className="section visual-demo-section"><div className="site-shell"><DemoClient /></div></section></MarketingShell>;
}
