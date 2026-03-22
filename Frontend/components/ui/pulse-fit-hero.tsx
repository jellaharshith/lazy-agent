"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  HeartHandshake,
  Leaf,
  Menu,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type SurplusLinkHeroNavItem = {
  label: string;
  href: string;
};

export type SurplusLinkHeroCard = {
  id: string;
  category: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
};

export type SurplusLinkHeroAction = {
  label: string;
  href: string;
};

export type SurplusLinkHeroProps = {
  logo: string;
  navItems: SurplusLinkHeroNavItem[];
  topCta: SurplusLinkHeroAction;
  title: string;
  subtitle: string;
  primaryAction: SurplusLinkHeroAction;
  secondaryAction: SurplusLinkHeroAction;
  disclaimer: string;
  socialProof: string;
  /** Optional small circular avatar images shown beside social proof */
  socialAvatars?: { src: string; alt: string }[];
  cards: SurplusLinkHeroCard[];
  className?: string;
};

const floatTransition = { duration: 5.5, repeat: Infinity, ease: "easeInOut" as const };

export function SurplusLinkHero({
  logo,
  navItems,
  topCta,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  disclaimer,
  socialProof,
  socialAvatars = [],
  cards,
  className,
}: SurplusLinkHeroProps) {
  const reduceMotion = useReducedMotion();
  const carouselId = useId();
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const safeCards = useMemo(() => (cards.length ? cards : []), [cards]);

  useEffect(() => {
    if (reduceMotion || safeCards.length <= 1) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % safeCards.length);
    }, 4200);
    return () => window.clearInterval(t);
  }, [reduceMotion, safeCards.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!safeCards.length) return;
      setActive((i) => (i + dir + safeCards.length) % safeCards.length);
    },
    [safeCards.length]
  );

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950/50 to-slate-900 text-slate-50",
        className
      )}
      aria-labelledby={`${carouselId}-title`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-6 sm:px-6 lg:gap-14 lg:px-8 lg:pt-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md">
              <Leaf className="h-5 w-5 text-emerald-300" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">{logo}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-200/90 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={topCta.href}
              className="hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 sm:inline-flex sm:items-center sm:gap-2"
            >
              {topCta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>

            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white backdrop-blur-md lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls={`${carouselId}-mobile-nav`}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="sr-only">Toggle menu</span>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div
            id={`${carouselId}-mobile-nav`}
            className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl backdrop-blur-xl lg:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile primary">
              {navItems.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-slate-100 hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={topCta.href}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950"
                onClick={() => setMobileOpen(false)}
              >
                {topCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </nav>
          </div>
        )}

        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100/95 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              AI-powered surplus matching
            </div>

            <div className="space-y-5">
              <h1
                id={`${carouselId}-title`}
                className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]"
              >
                {title}
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-slate-300/95 sm:text-xl">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-black/25 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <HeartHandshake className="h-4 w-4 text-emerald-700" aria-hidden />
                {primaryAction.label}
              </Link>
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                {secondaryAction.label}
                <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                {socialAvatars.length > 0 && (
                  <div className="flex -space-x-2" aria-hidden={socialAvatars.length === 0}>
                    {socialAvatars.slice(0, 4).map((a, idx) => (
                      <span
                        key={a.src + idx}
                        className="relative block h-9 w-9 overflow-hidden rounded-full border-2 border-slate-900 ring-2 ring-emerald-500/30"
                      >
                        <Image
                          src={a.src}
                          alt={a.alt}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      </span>
                    ))}
                  </div>
                )}
                <p className="font-medium text-slate-200/90">{socialProof}</p>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">{disclaimer}</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <motion.div
              className="relative mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-none"
              style={{ perspective: 1200 }}
              initial={false}
            >
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-white/10 backdrop-blur-xl" />

              <div className="relative flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
                    Live resource signals
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-400/25">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>

                <div className="relative mt-6 min-h-[280px] flex-1 sm:min-h-[300px]">
                  {safeCards.map((card, index) => {
                    const offset = (index - active + safeCards.length) % safeCards.length;
                    const isFront = offset === 0;
                    const depth = Math.min(offset, 3);
                    const y = depth * 10;
                    const scale = 1 - depth * 0.045;
                    const opacity = 1 - depth * 0.22;
                    const z = 30 - depth;

                    return (
                      <motion.article
                        key={card.id}
                        layout
                        className={cn(
                          "absolute left-0 right-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-2xl shadow-black/40",
                          isFront ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
                        )}
                        style={{ zIndex: z }}
                        animate={
                          reduceMotion
                            ? { y, scale, opacity }
                            : isFront
                              ? { y: [y, y - 8, y], scale, opacity }
                              : { y, scale, opacity }
                        }
                        transition={
                          reduceMotion
                            ? { duration: 0.2 }
                            : isFront
                              ? { y: floatTransition, scale: { duration: 0.35 }, opacity: { duration: 0.35 } }
                              : { duration: 0.35 }
                        }
                        drag={isFront && !reduceMotion ? "y" : false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        aria-hidden={!isFront}
                      >
                        <div className="relative h-44 sm:h-52">
                          <Image
                            src={card.imageUrl}
                            alt={card.imageAlt}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 420px"
                            priority={active === index && isFront}
                            loading={active === index ? "eager" : "lazy"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 space-y-1 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/95">
                              {card.category}
                            </p>
                            <h2 className="text-lg font-semibold leading-snug text-white sm:text-xl">
                              {card.title}
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-slate-300">
                          <span>Updated moments ago</span>
                          <span className="text-emerald-200/90">Nearby</span>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>

                <div className="mt-auto flex items-center justify-between pt-6">
                  <div className="flex gap-2">
                    {safeCards.map((_, i) => (
                      <button
                        key={`${carouselId}-dot-${i}`}
                        type="button"
                        className={cn(
                          "h-2 rounded-full transition-all",
                          i === active ? "w-7 bg-emerald-400" : "w-2 bg-white/25 hover:bg-white/40"
                        )}
                        aria-label={`Show card ${i + 1}`}
                        aria-pressed={i === active}
                        onClick={() => setActive(i)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      onClick={() => go(-1)}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      onClick={() => go(1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <div
              className="pointer-events-none absolute -bottom-6 left-8 right-8 h-16 rounded-[2rem] bg-emerald-500/10 blur-2xl"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}
