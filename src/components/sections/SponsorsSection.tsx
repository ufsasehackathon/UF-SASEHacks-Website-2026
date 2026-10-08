"use client"

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/images";
import FallingMascot from "@/components/FallingMascot";

gsap.registerPlugin(ScrollTrigger);

const SPONSORS = [
  {
    name: "ECE - Department of Experiental Learning",
    logo: getPublicImageUrl("/eceDepExpLogo.png"), 
    link: "https://www.ece.ufl.edu/academics/undergraduate/experiential-learning/",
  },
  {
    name: "Blue Origin",
    logo: getPublicImageUrl("/BlueOriginLogo.png"), 
    link: "https://blueorigin.com/",
  },
  {
    name: "ExxonMobil",
    logo: getPublicImageUrl("/ExxonMobilLogo.png"), 
    link: "https://exxonmobil.com/",
  },
  {
    name: "P&G",
    logo: getPublicImageUrl("/P&GLogo.jpeg"), 
    link: "https://pg.com/",
  },
  {
    name: "Sandia",
    logo: getPublicImageUrl("/SandiaLogo.jpg"), 
    link: "https://sandia.gov/",
  },
  {
    name: "AkioAI",
    logo: getPublicImageUrl("/akioAILogo.png"), 
    link: "https://akioai.com/",
  },
  {
    name: "DSI",
    logo: getPublicImageUrl("/dsiLogo.png"), 
    link: "https://www.ufdsi.com/",
  },
  {
    name: "First Florida Credit Union",
    logo: getPublicImageUrl("/firstfloridaLogo.png"), 
    link: "https://www.firstflorida.org/",
  },
  {
    name: "Alive Credit Union",
    logo: getPublicImageUrl("/aliveLogo.png"), 
    link: "https://www.alivecu.coop/",
  },
  {
    name: "Florida Community Innovation",
    logo: getPublicImageUrl("/fciLogo.png"), 
    link: "https://floridainnovation.org/",
  },
  {
    name: "Pure Buttons",
    logo: getPublicImageUrl("/Pure-Buttons-Blue-Gradient-Logo-RGB.png"), 
    link: "https://mlh.link/MLH-PureButtons-hackathons",
  },
  {
    name: "Celsius",
    logo: getPublicImageUrl("/CelsiusLogo.png"), 
    link: "https://www.celsius.com/",
  },
  {
    name: "Snag",
    logo: getPublicImageUrl("/snagLogo.png"), 
    link: "https://snagdelivery.app/",
  },
  {
    name: "DalMoros Pasta Lab",
    logo: getPublicImageUrl("/dalmorosLogo.png"), 
    link: "https://dalmoros.us/",
  },
  {
    name: "Dominos",
    logo: getPublicImageUrl("/dominosLogo.png"), 
    link: "https://www.dominos.com/",
  },
  {
    name: "VuPlay",
    logo: getPublicImageUrl("/vuplayLogo.png"), 
    link: "https://vuplaycreative.carrd.co/",
  },
  {
    name: "FDOT",
    logo: getPublicImageUrl("/fdotLogo.png"), 
    link: "https://www.fdot.gov/",
  },
];

export default function SponsorsSection() {
  const sponsorsTitleRef = useRef<HTMLHeadingElement>(null);
  const sponsorsGridRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Animate title
    [sponsorsTitleRef, titleRef].forEach((ref) => {
      if (ref.current) {
        gsap.fromTo(
          ref.current,
          { opacity: 0, y: -30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ref.current,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    });

    // Animate sponsor grids
    if (sponsorsGridRef.current) {
      gsap.fromTo(
        sponsorsGridRef.current.children,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "back.out(1.2)",
          scrollTrigger: {
            trigger: sponsorsGridRef.current,
            start: "top 90%",
          },
        }
      );
    }

    // Animate CTA card
    if (ctaRef.current) {
      gsap.fromTo(
        ctaRef.current,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 85%",
            toggleActions: "play none none none"
          }
        }
      );
    }
  }, []);

  const copyEmail = () => {
    navigator.clipboard.writeText("ufsase.evp@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="sponsors" className="w-full min-h-screen flex flex-col items-center relative overflow-hidden py-16 md:py-20">
      <div className="absolute inset-0 z-0">
        <Image src={getPublicImageUrl("sponsor/sponsorBackground.png")} alt="Sponsor Background" fill className="object-cover" priority unoptimized />
      </div>

      <div className="absolute right-4 -bottom-12 md:right-20 md:bottom-45 lg:right-32 z-20 w-32 md:w-48 lg:w-64">
        <FallingMascot
          src={getPublicImageUrl("sponsor/sponsorMascot.png")}
          alt="Sponsor Mascot"
          width={400}
          height={400}
          fallDistance={700}
          duration={2}
          rotations={1.8}
          startScale={0.2}
          endScale={1}
          startRotateX={65}
          wobbleIntensity={35}
          triggerStart="top 70%"
          ease="power2.out"
          floatDistance={20}
          floatDuration={3}
        />
      </div>

      <div className="mx-auto max-w-screen-xl px-4 md:px-8 relative z-10 w-full">
        
        {/* Sponsors section */}
        <div className="mb-20 md:mb-32">
          <h2 ref={sponsorsTitleRef} className="font-[family-name:var(--font-heading)] text-white text-4xl md:text-6xl lg:text-7xl mb-4 text-center drop-shadow-lg uppercase">
            LAST YEAR&apos;S SPONSORS
          </h2>
          <p className="font-[family-name:var(--font-body)] text-white text-lg md:text-xl mb-12 text-center drop-shadow-md max-w-2xl mx-auto">
            Thank you to our amazing sponsors from last year who made SASEHacks possible!
          </p>

          <div 
            ref={sponsorsGridRef}
            className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 items-center max-w-5xl mx-auto md:flex md:flex-wrap md:justify-center md:gap-10"
          >
            {SPONSORS.map((sponsor, index) => (
              <a
                key={index}
                href={sponsor.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl p-2 md:p-4 transition-all duration-300 hover:scale-105 shadow-lg flex items-center justify-center aspect-[4/3] md:w-64 md:h-48"
              >
                <div className="relative w-full h-full">
                  <Image
                    src={sponsor.logo}
                    alt={sponsor.name}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Become a Sponsor */}
        <div className="mt-12">
          <h2
            ref={titleRef}
            className="font-[family-name:var(--font-heading)] text-white text-3xl md:text-5xl lg:text-6xl mb-8 md:mb-12 text-center drop-shadow-lg"
          >
            BECOME A SPONSOR
          </h2>

          <div
            ref={ctaRef}
            className="bg-[#FFE4B3] rounded-3xl p-6 md:p-10 lg:p-12 shadow-2xl mb-8 md:mb-12 max-w-3xl mx-auto border-4 border-[#560700] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#560700] opacity-5 rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#560700] opacity-5 rounded-tr-full" />

            <h3 className="font-[family-name:var(--font-heading)] text-[#560700] text-2xl md:text-3xl lg:text-4xl mb-4 md:mb-6 text-center relative z-10">
              Support Innovation at UF
            </h3>

            <p className="font-[family-name:var(--font-body)] text-gray-800 text-base md:text-lg lg:text-xl leading-relaxed mb-6 md:mb-8 text-center max-w-2xl mx-auto relative z-10">
              Help us create an amazing experience for student developers. Your sponsorship enables us to provide
              resources, prizes, mentorship, and unforgettable opportunities for participants.
            </p>

            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg max-w-md mx-auto relative z-10">
              <p className="font-[family-name:var(--font-body)] text-gray-600 text-sm mb-3 text-center">
                Get in touch with us:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 bg-[#BFDCFF] rounded-lg px-3 md:px-4 py-2 md:py-3 font-[family-name:var(--font-body)] text-[#560700] font-semibold text-center text-sm md:text-base break-all">
                  ufsase.hackathon@gmail.com
                </div>
                <button
                  onClick={copyEmail}
                  className="bg-[#560700] text-[#FFE4B3] px-4 md:px-6 py-2 md:py-3 rounded-lg font-[family-name:var(--font-body)] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0 text-sm md:text-base"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="mt-6 md:mt-8 text-center relative z-10">
              <a
                href="mailto:ufsase.evp@gmail.com?subject=Sponsorship Inquiry for UF SASEHacks"
                className="inline-block bg-[#560700] text-[#FFE4B3] px-6 md:px-8 py-3 md:py-4 rounded-2xl font-[family-name:var(--font-heading)] text-lg md:text-xl lg:text-2xl hover:scale-105 transition-transform duration-300 shadow-lg"
              >
                EMAIL US
              </a>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center max-w-3xl mx-auto pb-10">
          <p className="font-[family-name:var(--font-body)] text-white text-base md:text-lg drop-shadow-lg opacity-90">
            We offer various sponsorship tiers to fit your organization&apos;s goals and budget. Reach out to discuss
            custom sponsorship packages!
          </p>
        </div>
      </div>
    </section>
  );
}