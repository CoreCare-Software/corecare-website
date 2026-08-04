import type { Metadata } from "next";
import ContactClient from "./contact-client";

export const metadata: Metadata = { title: "Contact and demonstrations", description: "Book a CoreCare product demonstration or ask the CoreCare Systems team a question.", alternates: { canonical: "/contact" } };

export default function ContactPage() { return <ContactClient />; }
