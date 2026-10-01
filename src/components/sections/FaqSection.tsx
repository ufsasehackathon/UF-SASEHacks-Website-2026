"use client"

import { DISCORD_INVITE, DEVPOST_URL } from "@/lib/constants"
import FaqList from "@/components/FaqList"
import type { FaqItem } from "@/lib/faq"
import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"
import { getPublicImageUrl } from "@/lib/images"
import FallingMascot from "@/components/FallingMascot"

gsap.registerPlugin(ScrollTrigger)

type Props = {
  faqItems: FaqItem[]
}

export default function FaqSection({ faqItems }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const faqListRef = useRef<HTMLDivElement>(null)
  const buttonsRef = useRef<HTMLDivElement>(null)
  const windLeavesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Animate title
    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: -30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        },
      )
    }

    // Animate FAQ list - on load instead of scroll
    if (faqListRef.current) {
      gsap.fromTo(
        faqListRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
        },
      )
    }

    // Animate buttons - on load instead of scroll
    if (buttonsRef.current) {
      gsap.fromTo(
        buttonsRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: 0.2,
          ease: "power3.out",
        },
      )
    }

    // Animate wind and leaves
    if (windLeavesRef.current) {
      gsap.to(windLeavesRef.current, {
        x: 20,
        y: 12,
        rotation: 2,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      })
    }
  }, [])

  return (
    <section id="faq" className="w-full min-h-screen flex items-center relative overflow-hidden py-16 md:py-24">
      <div className="absolute inset-0 z-0">
        <Image
          src={getPublicImageUrl("faq/faqBackground.png")}
          alt="FAQ Background"
          fill
          className="object-cover"
          style={{ objectPosition: "center" }}
          priority
          unoptimized
        />
      </div>
      {/* Flag and Mascot Layer */}
      <div className="absolute left-[-160px] sm:left-[-160px] md:left-[-160px] top-30 md:top-20 lg:top-13 z-20 w-[600px] sm:w-[600px] md:w-[660px] lg:w-[670px] pointer-events-none">
        <div className="relative w-full">
          {/* FAQ Flag */}
          <Image
            src={getPublicImageUrl("faq/faqFlag.png")}
            alt="FAQ Flag"
            width={500}
            height={700}
            className="w-full h-auto drop-shadow-lg"
            unoptimized
          />

          <div 
            className="absolute left-[31%] top-[50%] md:top-[48%] w-[32%] sm:w-[34%] md:w-[38%] lg:w-[38%] overflow-visible"
          >
            <FallingMascot
              src={getPublicImageUrl("faq/faqMascot.png")}
              alt="FAQ Mascot"
              width={300}
              height={300}
              fallDistance={500}
              duration={2.2}
              rotations={1.5}
              startScale={0.15}
              endScale={1}
              startRotateX={50}
              wobbleIntensity={25}
              triggerStart="top 75%"
              ease="power2.out"
              floatDistance={10}
              floatDuration={4}
            />
          </div>
        </div>
      </div>

      {/* Wind and Leaves*/}
      <div
        ref={windLeavesRef}
        className="absolute bottom-0 left-20 md:left-60 w-[90%] md:w-[77%] pointer-events-none z-[5] opacity-90"
      >
        <Image
          src={getPublicImageUrl("faq/faqWindLeaves.png")}
          alt="Wind and Leaves"
          width={1200}
          height={600}
          className="w-full h-auto"
          unoptimized
        />
      </div>

      <div className="mx-auto max-w-screen-xl px-4 md:px-8 w-full relative z-30 mt-45 md:mt-15">
        {/* FAQ List */}
        <div ref={faqListRef} className="mb-8 md:mb-12">
          <FaqList items={faqItems} />
        </div>

        {/* Action Buttons */}
        <div ref={buttonsRef} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl px-6 md:px-8 py-3 md:py-4 font-[family-name:var(--font-heading)] text-lg md:text-xl bg-[#560700] text-[#FFE4B3] hover:scale-105 transition-transform duration-300 shadow-lg"
          >
            Join Discord
          </a>
          <a
            href={DEVPOST_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl px-6 md:px-8 py-3 md:py-4 font-[family-name:var(--font-heading)] text-lg md:text-xl bg-[#FFE4B3] text-[#560700] border-4 border-[#560700] hover:scale-105 transition-transform duration-300 shadow-lg"
          >
            Devpost
          </a>
        </div>
      </div>
    </section>
  );
}