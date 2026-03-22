"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Radar, Zap } from "lucide-react";

import { SurplusLinkHero, type SurplusLinkHeroProps } from "@/components/ui/pulse-fit-hero";

const heroContent: SurplusLinkHeroProps = {
  logo: "SurplusLink",
  navItems: [
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Live Matches", href: "/matches" },
    { label: "For Donors", href: "/provider" },
    { label: "Impact", href: "/#impact" },
    { label: "Contact", href: "/#contact" },
  ],
  topCta: { label: "Join the Network", href: "/flow" },
  title: "Unused food. Hidden needs. One smart match.",
  subtitle:
    "AI detects urgent need signals and connects people to nearby surplus meals, community fridges, and food support in real time.",
  primaryAction: { label: "Find Help", href: "/need" },
  secondaryAction: { label: "Share Resources", href: "/resources" },
  disclaimer: "Sign in to request food and see matches from listings in your area.",
  socialProof: "128 meals rescued today • 42 nearby resources",
  socialAvatars: [
    {
      src: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=128&h=128&q=80",
      alt: "Community member portrait",
    },
    {
      src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&h=128&q=80",
      alt: "Volunteer portrait",
    },
    {
      src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&h=128&q=80",
      alt: "Neighbor portrait",
    },
  ],
  cards: [
    {
      id: "1",
      category: "URGENT MATCH",
      title: "10 meals available nearby",
      imageUrl:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Packaged meals and food boxes ready for distribution",
    },
    {
      id: "2",
      category: "COMMUNITY FRIDGE",
      title: "Fresh produce restocked",
      imageUrl:
        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Open refrigerator stocked with fresh community food",
    },
    {
      id: "3",
      category: "LOCAL PARTNER",
      title: "Cafe donating dinner trays",
      imageUrl:
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Prepared meals and trays from a local cafe",
    },
    {
      id: "4",
      category: "LIVE NEED",
      title: "Food request detected",
      imageUrl:
        "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Volunteers sorting donated food at a community event",
    },
    {
      id: "5",
      category: "IMPACT",
      title: "128 meals rescued today",
      imageUrl:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Fresh produce boxes at a food rescue hub",
    },
  ],
};

const features = [
  {
    title: "Detect Need",
    description:
      "Natural-language signals are interpreted with care to surface urgency without exposing sensitive details.",
    icon: Radar,
  },
  {
    title: "Find Nearby Resources",
    description:
      "Surplus meals, fridges, and partner donations are surfaced on a map-aware radius in seconds.",
    icon: MapPin,
  },
  {
    title: "Match in Real Time",
    description:
      "Live routing connects the right resource to the right moment—before food expires or need escalates.",
    icon: Zap,
  },
] as const;

export function SurplusLinkLandingDemo() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-slate-950 text-slate-50">
      <SurplusLinkHero {...heroContent} />

      <section
        id="how-it-works"
        className="relative border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900"
        aria-labelledby="how-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Compassionate matching, engineered for speed
            </h2>
            <p className="mt-4 text-pretty text-lg text-slate-300">
              Three coordinated steps turn surplus into support—transparently, locally, and fast enough to matter.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/30 backdrop-blur-md"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl transition group-hover:bg-emerald-400/15" />
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/25">
                    <Icon className="h-6 w-6 text-emerald-200" aria-hidden />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="impact"
        className="border-t border-white/10 bg-slate-900/60"
        aria-labelledby="impact-heading"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h2 id="impact-heading" className="text-lg font-semibold text-white">
              Impact you can feel today
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Every match prevents waste and steadies a neighbor—measured in meals, minutes, and miles saved.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
              128 meals rescued today
            </span>
            <span className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50">
              42 nearby resources
            </span>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="border-t border-white/10 bg-gradient-to-b from-slate-900 to-slate-950"
        aria-labelledby="contact-heading"
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md sm:p-10">
            <h2 id="contact-heading" className="text-2xl font-bold text-white">
              Partner with SurplusLink
            </h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Hosting a fridge, donating surplus, or integrating your dispatch workflow? We will route the conversation
              to the right pilot partner.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:hello@surpluslink.org"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                hello@surpluslink.org
              </a>
              <Link
                href="/flow"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Open intake flow
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
