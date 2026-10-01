"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { getPublicImageUrl } from "@/lib/images"
import FallingMascot from "@/components/FallingMascot"

gsap.registerPlugin(ScrollTrigger)

type ScheduleEvent = {
  time: string
  title: string
  location?: string
  color: string
}

const DAYS = [
  { id: "friday", label: "DAY 1", events: [] as ScheduleEvent[] },
  { id: "saturday", label: "DAY 2", events: [] as ScheduleEvent[] },
  { id: "sunday", label: "DAY 3", events: [] as ScheduleEvent[] },
] as const

export default function ScheduleSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const [selectedDay, setSelectedDay] = useState<(typeof DAYS)[number]["id"]>("friday")

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title Entrance
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { opacity: 0, y: -20 },
          {
            opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
            scrollTrigger: {
              trigger: titleRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        )
      }

      // INFINITE SCROLLING MUSIC NOTES
      if (marqueeRef.current) {
        gsap.to(marqueeRef.current, {
          xPercent: -50,
          ease: "none",
          duration: 30,
          repeat: -1,
        })
      }
    }, containerRef)

    return () => ctx.revert()
  }, [])

  const events: readonly ScheduleEvent[] = DAYS.find((d) => d.id === selectedDay)?.events ?? []

  return (
    <section id="schedule" ref={containerRef} className="w-full relative overflow-hidden bg-[#fec6e7]">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={getPublicImageUrl("schedule/scheduleBackground.png")}
          alt="Schedule Background"
          fill
          className="object-cover object-bottom opacity-80"
          priority
          unoptimized
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 pt-16">
        <h2 ref={titleRef} className="font-[family-name:var(--font-heading)] text-[#560700] text-5xl md:text-7xl mb-8 text-center drop-shadow-md">
          SCHEDULE
        </h2>

        {/* Day Selector */}
        <div className="flex justify-center gap-3 md:gap-6 mb-12">
          {DAYS.map((day) => (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`px-5 md:px-8 py-4 rounded-2xl font-[family-name:var(--font-heading)] text-xl md:text-2xl transition-all duration-300 shadow-xl border-4 ${
                selectedDay === day.id
                  ? "bg-[#560700] text-[#FFE4B3] border-[#560700] scale-105"
                  : "bg-[#FFE4B3] text-[#560700] border-[#560700] hover:scale-105"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="max-w-4xl mx-auto relative mb-8">
          {/* Central Line */}
          <div className="absolute left-[6.5rem] md:left-32 top-0 bottom-0 w-1 bg-[#560700]/20" />
          
          {events.length === 0 && (
            <div className="bg-[#FFE4B3] rounded-2xl p-8 md:p-12 shadow-lg border-4 border-white text-center">
              <h3 className="font-[family-name:var(--font-heading)] text-[#560700] text-3xl md:text-4xl">
                Coming Soon
              </h3>
            </div>
          )}

          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={index} className="relative flex items-start gap-4 md:gap-8 group">
                {/* Time Badge */}
                <div className="w-24 md:w-32 flex-shrink-0">
                  <div className="bg-[#560700] text-[#FFE4B3] rounded-xl px-3 py-2 text-center shadow-lg">
                    <span className="font-[family-name:var(--font-body)] font-bold text-sm md:text-base whitespace-nowrap">
                      {event.time}
                    </span>
                  </div>
                </div>

                {/* Timeline Dot */}
                <div className="absolute left-[6.3rem] md:left-[7.6rem] top-3 w-4 h-4 bg-[#560700] rounded-full border-4 border-[#fec6e7] z-10 group-hover:scale-150 transition-transform duration-300" />

                {/* Event Card */}
                <div className={`flex-1 ${event.color} rounded-2xl p-4 md:p-6 shadow-lg border-4 border-white hover:border-[#560700] transition-all duration-300 hover:scale-105`}>
                  <h3 className="font-[family-name:var(--font-heading)] text-[#560700] text-lg md:text-xl mb-1">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="font-[family-name:var(--font-body)] text-gray-700 text-sm md:text-base flex items-center gap-1">
                       📍 {event.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

         {/* Note */}
        <div className="mb-4 md:mb-6 text-center">
          <p className="font-[family-name:var(--font-body)] text-gray-800 text-sm md:text-base max-w-2xl mx-auto px-4">
            Schedule is subject to change. Stay tuned for updates closer to the event!
          </p>
        </div>

        {/* BOTTOM DECORATION */}
        <div className="relative h-[220px] md:h-[380px] w-screen left-1/2 -translate-x-1/2 flex items-end justify-center overflow-hidden">
          
          {/* Music Notes */}
          <div className="absolute bottom-12 md:bottom-20 w-full overflow-hidden pointer-events-none select-none">
            <div ref={marqueeRef} className="flex w-[200%] items-center whitespace-nowrap">
              <div className="flex w-1/2 shrink-0">
                <Image 
                  src={getPublicImageUrl("schedule/scheduleMusicNotes.png")} 
                  alt="" 
                  width={1920} 
                  height={150} 
                  className="w-full h-auto object-cover opacity-90" 
                  unoptimized
                />
              </div>
              <div className="flex w-1/2 shrink-0">
                <Image 
                  src={getPublicImageUrl("schedule/scheduleMusicNotes.png")} 
                  alt="" 
                  width={1920} 
                  height={150} 
                  className="w-full h-auto object-cover opacity-90" 
                  unoptimized
                />
              </div>
            </div>
          </div>

          <div className="relative w-[180px] sm:w-[220px] md:w-[320px] lg:w-[350px] z-20 pointer-events-none bottom-2 md:bottom-6 overflow-visible isolate drop-shadow-none">
            <FallingMascot
              src={getPublicImageUrl("schedule/scheduleMascot.png")}
              alt="Schedule Mascot"
              width={500}
              height={500}
              fallDistance={500}
              duration={2.5}
              rotations={1}
              startScale={0.3}
              endScale={1}
              startRotateX={45}
              wobbleIntensity={20}
              triggerStart="top 85%"
              ease="power2.out"
              floatDistance={15}
              floatDuration={3}
            />
          </div>
        </div>
      </div>
    </section>
  )
}