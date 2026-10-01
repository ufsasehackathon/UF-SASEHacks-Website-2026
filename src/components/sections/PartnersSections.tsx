"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { getPublicImageUrl } from "@/lib/supabase/storage";

const PARTNER_CARDS = [
  {
    name: "GatorAI",
    image: getPublicImageUrl("partners/gatorAICard.png"),
    link: "https://www.ufgatorai.info/",
    className:
      "top-[-7%] left-[14%] sm:left-[15%] md:left-[16%] lg:top-[-2%] lg:left-[15%] xl:left-[16%] w-[30%] sm:w-[24%] md:w-[20%] lg:w-[18%] xl:w-[17%] rotate-[-20deg]",
  },
  {
    name: "Open Source Club",
    image: getPublicImageUrl("partners/OSCCard.png"),
    link: "https://ufosc.org/",
    className:
      "top-[24%] left-[0%] sm:left-[2%] md:left-[4%] lg:top-[28%] lg:left-[3%] xl:top-[27%] xl:left-[4%] w-[30%] sm:w-[24%] md:w-[20%] lg:w-[18%] xl:w-[17%] rotate-[-4deg]",
  },
  {
    name: "PC Building Club",
    image: getPublicImageUrl("partners/pcBuildingCard.png"),
    link: "https://www.spcbatuf.org/",
    className:
      "bottom-[3%] left-[16%] sm:left-[17%] md:left-[18%] lg:top-[54%] lg:right-[8%] lg:left-auto xl:top-[53%] xl:right-[9%] xl:left-auto w-[32%] sm:w-[26%] md:w-[22%] lg:w-[20%] xl:w-[19%] rotate-[10deg]",
  },
  {
    name: "WiCSE",
    image: getPublicImageUrl("partners/wicseCard.png"),
    link: "https://ufwicse.com/",
    className:
      "top-[8%] right-[7%] sm:right-[8%] md:right-[10%] lg:top-[6%] lg:right-[11%] xl:right-[12%] w-[27%] sm:w-[21%] md:w-[17%] lg:w-[16%] xl:w-[15%] rotate-[8deg]",
  },
  {
    name: "SHPE",
    image: getPublicImageUrl("partners/spheCard.png"),
    link: "https://www.shpeuf.com/",
    className:
      "bottom-[11%] right-[5%] sm:right-[6%] md:right-[8%] lg:top-[61%] lg:left-[13%] lg:right-auto xl:top-[60%] xl:left-[14%] xl:right-auto w-[31%] sm:w-[25%] md:w-[21%] lg:w-[18%] xl:w-[17%] rotate-[-18deg]",
  },
];

export default function PartnersSections() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, index) => {
        if (!card) return;

        gsap.to(card, {
          y: index % 2 === 0 ? -20 : -28,
          duration: 2.6 + index * 0.2,
          delay: index * 0.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="partners"
      className="relative w-full min-h-[76vh] overflow-hidden pt-10 pb-2 sm:min-h-screen sm:py-10 md:py-16"
    >
      <div className="absolute inset-0 z-0 bg-[#EAD6A8]">
        <Image
          src={getPublicImageUrl("partners/partnerBackground.png")}
          alt="Partner section background"
          fill
          className="object-cover"
          unoptimized
          priority
        />
      </div>

      <div className="relative z-10 mx-auto w-full">
        <div className="relative mx-auto mt-8 w-full min-h-[470px] sm:mt-0 sm:min-h-[540px] md:min-h-[640px] lg:min-h-[760px]">
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src={getPublicImageUrl("partners/partnerMascotTitle.png")}
              alt="Student organization partners"
              width={1200}
              height={1200}
              className="absolute left-1/2 top-1/2 h-auto w-[124%] sm:w-[108%] md:w-[90%] lg:w-[74%] xl:w-[70%] max-w-none -translate-x-1/2 -translate-y-1/2"
              unoptimized
              priority
            />
          </div>

          {PARTNER_CARDS.map((partner, index) => (
            <a
              key={partner.name}
              ref={(element) => {
                cardsRef.current[index] = element;
              }}
              href={partner.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={partner.name}
              className={`absolute z-20 transition-transform duration-300 hover:scale-105 ${partner.className}`}
            >
              <Image
                src={partner.image}
                alt={partner.name}
                width={900}
                height={900}
                className="h-auto w-full"
                unoptimized
              />
            </a>
          ))}
        </div>

        <div className="relative z-30 mx-auto mt-3 w-full max-w-3xl px-4 text-center sm:mt-4 md:mt-5">
          <p
            className="font-[family-name:var(--font-body)] text-base font-semibold text-white sm:text-lg md:text-xl"
            style={{
              textShadow:
                "-1px -1px 0 #560700, 1px -1px 0 #560700, -1px 1px 0 #560700, 1px 1px 0 #560700",
            }}
          >
            Shoutout to last year&apos;s amazing student organization partners! Check out their websites by clicking on the cards.
          </p>
        </div>
      </div>
    </section>
  );
}