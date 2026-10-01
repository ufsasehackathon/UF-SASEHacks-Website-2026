"use client"

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import Image from "next/image";
import { DATES, CITY, VENUE } from "@/lib/constants";
import { getPublicImageUrl } from "@/lib/supabase/storage";
import FallingMascot from "@/components/FallingMascot";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Draggable)
}

const keycapPositions = [
  { id: 1, initialX: "8%", initialY: "18%", size: "w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28" },
  { id: 2, initialX: "82%", initialY: "12%", size: "w-18 h-18 md:w-22 md:h-22 lg:w-26 lg:h-26" },
  { id: 3, initialX: "10%", initialY: "68%", size: "w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28" },
  { id: 4, initialX: "86%", initialY: "72%", size: "w-18 h-18 md:w-22 md:h-22 lg:w-26 lg:h-26" },
]

const keycapImages = [
  getPublicImageUrl("/home/homeKeycap1.png"),
  getPublicImageUrl("/home/homeKeycap2.png"),
  getPublicImageUrl("/home/homeKeycap3.png"),
  getPublicImageUrl("/home/homeKeycap4.png"),
]

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const keycapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const ctx = gsap.context(() => {
      // Floating title animation
      if (titleRef.current) {
        gsap.to(titleRef.current, {
          y: -15,
          duration: 2.5,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
          delay: 0.3,
        })
      }

      // Entrance animations
      if (contentRef.current) {
        gsap.fromTo(contentRef.current, 
          { opacity: 0, y: 30 }, 
          { opacity: 1, y: 0, duration: 0.8, delay: 0.5, ease: "power3.out" }
        )
      }

      // Keycap floating & Draggable logic
      keycapRefs.current.forEach((keycap, index) => {
        if (keycap) {
          const floatAnim = gsap.to(keycap, {
            y: "+=15",
            x: "+=8",
            rotation: gsap.utils.random(-8, 8),
            duration: gsap.utils.random(2.5, 3.5),
            ease: "power1.inOut",
            yoyo: true,
            repeat: -1,
            delay: index * 0.2,
          })

          Draggable.create(keycap, {
            type: "x,y",
            edgeResistance: 0.5,
            bounds: sectionRef.current,
            onDragStart: function() {
              floatAnim.kill();
            },
            onRelease: function() {
              gsap.to(this.target, {
                y: "+=10",
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
              });
            }
          })
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [isClient])

  return (
    <section ref={sectionRef} className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden pt-24 pb-32">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={getPublicImageUrl("/home/homeBackground.png")}
          alt="Hero background"
          fill
          className="object-cover object-bottom"
          priority
          unoptimized
        />
      </div>

      {/* Keycaps */}
      {isClient &&
        keycapPositions.map((pos, index) => (
          <div
            key={pos.id}
            ref={(el) => { keycapRefs.current[index] = el }}
            className={`absolute ${pos.size} cursor-grab active:cursor-grabbing z-30`}
            style={{ left: pos.initialX, top: pos.initialY }}
          >
            <Image
              src={keycapImages[index]}
              alt={`Keycap ${pos.id}`}
              fill
              className="object-contain pointer-events-none select-none"
              draggable={false}
              unoptimized
            />
          </div>
        ))}

      <div className="relative z-20 flex flex-col items-center w-full max-w-screen-xl px-4">
        
        {/* GRAPHICS SECTION */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-12 mb-8 lg:mb-16 overflow-visible isolate drop-shadow-none">
          <FallingMascot
            src={getPublicImageUrl("/home/homeMascot.png")}
            alt="SASEHacks Mascot"
            className="w-70 h-60 md:h-64 lg:w-96 lg:h-96 flex-shrink-0 lg:translate-x-35"
            fallDistance={600}
            duration={1.8}
            rotations={1}
            startScale={0.2}
            endScale={1}
            startRotateX={60}
            wobbleIntensity={25}
            triggerStart="top 90%"
            floatDistance={20}
            floatDuration={2}
          />

          <div ref={titleRef} className="relative w-[400px] h-[220px] md:w-[600px] md:h-[250px] lg:w-[850px] lg:h-[380px]">
            <Image
              src={getPublicImageUrl("/home/homeTitle.png")}
              alt="SASE HACKS"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* INFORMATION SECTION */}
        <div ref={contentRef} className="flex flex-col items-center text-center max-w-5xl">
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <div className="inline-flex items-center rounded-full bg-[#ebb8ce] text-[#560700] px-6 py-2 text-sm md:text-base font-[family-name:var(--font-body)] font-bold shadow-md uppercase border-2 border-[#560700]/10">
              📍 {VENUE}, {CITY}
            </div>
            <div className="inline-flex items-center rounded-full bg-white text-[#560700] px-6 py-2 text-sm md:text-base font-[family-name:var(--font-body)] font-bold shadow-md border-2 border-[#ebb8ce] uppercase">
              📅 {DATES}
            </div>
          </div>

          <p className="font-[family-name:var(--font-body)] text-[#560700] text-lg md:text-2xl mb-12 font-medium leading-relaxed max-w-3xl drop-shadow-sm">
            Build something amazing in 36 hours. Meet new teammates, learn from mentors, and ship projects you&apos;ll be proud of!
          </p>

          <div className="flex flex-wrap gap-5 justify-center items-center w-full max-w-4xl">
            {/* <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdppaUTD5V9QS-ZwI-wpW-qYDOMFEmjsRAEV8iH7ptMWKM64Q/viewform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-8 py-4 font-[family-name:var(--font-heading)] text-xl md:text-2xl bg-[#ebb8ce] text-[#560700] hover:scale-105 transition-transform duration-300 shadow-xl border-4 border-[#560700] min-w-[240px]"
            >
              REGISTER TO MENTOR
            </a>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScrf7-ORZVvGSeu1UnLiauDJ5npfaMU-vnJaurH3iiX-SCO1g/viewform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-8 py-4 font-[family-name:var(--font-heading)] text-xl md:text-2xl bg-[#ebb8ce] text-[#560700] hover:scale-105 transition-transform duration-300 shadow-xl border-4 border-[#560700] min-w-[240px]"
            >
              SIGN UP TO VOLUNTEER
            </a> */}
          </div>

          {/* Scroll indicator */}
          <div className="mt-20 animate-bounce">
            <div className="inline-block text-[#560700] text-5xl opacity-40">
              ↓
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/50 to-transparent pointer-events-none" />
    </section>
  )
}