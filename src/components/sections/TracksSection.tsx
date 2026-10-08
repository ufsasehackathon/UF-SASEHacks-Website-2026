"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getPublicImageUrl } from "@/lib/images";
import FallingMascot from "@/components/FallingMascot";

gsap.registerPlugin(ScrollTrigger);

const DESCRIPTION_PREVIEW_LENGTH = 260;
const MOBILE_DESCRIPTION_PREVIEW_LENGTH = 80;

const allPrizes = [
  { type: "Tracks & Prizes", name: "Coming Soon", sponsor: "", prize: "", desc: "" },
];

const ChevronLeft = () => (
  <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function TracksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const smallBubbles1Ref = useRef<HTMLDivElement>(null);
  const smallBubbles2Ref = useRef<HTMLDivElement>(null);
  const reefsRef = useRef<HTMLDivElement>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeDescriptionIndex, setActiveDescriptionIndex] = useState<number | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (smallBubbles1Ref.current) {
        gsap.to(smallBubbles1Ref.current, {
          y: -40,
          duration: 5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
      if (smallBubbles2Ref.current) {
        gsap.to(smallBubbles2Ref.current, {
          y: -30,
          duration: 4.5,
          delay: 1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      if (reefsRef.current) {
        gsap.to(reefsRef.current, {
          x: 15,
          duration: 4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allPrizes.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allPrizes.length) % allPrizes.length);
  };

  const closeDescriptionModal = () => setActiveDescriptionIndex(null);

  return (
    <section
      id="tracks"
      ref={containerRef}
      className="relative w-full min-h-[75vh] sm:min-h-[100vh] lg:min-h-[120vh] overflow-hidden bg-[#7CD0E0] pt-24 sm:pt-14 md:pt-16 lg:pt-20 flex flex-col items-center justify-start sm:justify-center pb-2 sm:pb-0"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={getPublicImageUrl("track/trackBackground.png")}
          alt="Underwater Background"
          fill
          className="object-cover object-center"
          priority
          unoptimized
        />
      </div>

      <div className="relative z-30 mb-2 sm:mb-8 md:mb-12 mt-6 sm:mt-2 md:mt-4 flex-shrink-0">
        <h2 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] text-[#560700] text-center px-4 drop-shadow-md tracking-wide">
          Tracks & Prizes
        </h2>
      </div>

      {/* --- Slider Container --- */}
      <div className={`relative z-30 flex items-center ${allPrizes.length < 2 ? "justify-center" : "justify-between"} w-full max-w-[1400px] px-2 sm:px-8 md:px-16 mb-2 sm:mb-8 md:mb-32 shrink-0 mt-2 sm:mt-8 md:mt-0`}>

        {/* Nav Button Left */}
        <button
          onClick={handlePrev}
          hidden={allPrizes.length < 2}
          className="z-50 p-2 sm:p-4 md:p-5 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-[#560700] transition-transform hover:scale-110 shadow-lg border border-white/30 flex-shrink-0"
          aria-label="Previous Track"
        >
          <ChevronLeft />
        </button>

        {/* Bubbles Stack */}
        <div className="relative w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px] aspect-square flex items-center justify-center mx-2 sm:mx-8">
          {allPrizes.map((item, index) => {
            const diff = index - currentIndex;
            const length = allPrizes.length;
            let offset = diff;

            if (offset > length / 2) offset -= length;
            if (offset < -length / 2) offset += length;

            let transform = "translateX(0) scale(1)";
            let opacity = 1;
            let zIndex = 30;
            let pointerEvents = "auto";

            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

            if (offset === 0) {
              transform = `translateX(0) scale(${isMobile ? 1.1 : 1})`;
              opacity = 1;
              zIndex = 40;
            } else if (offset === -1 || offset === length - 1) { // Prev item
              transform = `translateX(${isMobile ? '-35%' : '-45%'}) scale(${isMobile ? 0.8 : 0.85})`;
              opacity = 0.8;
              zIndex = 30;
              pointerEvents = "none";
            } else if (offset === 1 || offset === -length + 1) { // Next item
              transform = `translateX(${isMobile ? '35%' : '45%'}) scale(${isMobile ? 0.8 : 0.85})`;
              opacity = 0.8;
              zIndex = 30;
              pointerEvents = "none";
            } else if (offset === -2 || offset === length - 2) {
              transform = `translateX(${isMobile ? '-65%' : '-80%'}) scale(${isMobile ? 0.6 : 0.65})`;
              opacity = 0.4;
              zIndex = 20;
              pointerEvents = "none";
            } else if (offset === 2 || offset === -length + 2) {
              transform = `translateX(${isMobile ? '65%' : '80%'}) scale(${isMobile ? 0.6 : 0.65})`;
              opacity = 0.4;
              zIndex = 20;
              pointerEvents = "none";
            } else {
              transform = `translateX(${offset > 0 ? 100 : -100}%) scale(0.4)`;
              opacity = 0;
              zIndex = 0;
              pointerEvents = "none";
            }

            const bubbleImg = index % 2 === 0 ? "track/trackBubble1.png" : "track/trackBubble2.png";
            const previewLength = isMobile ? MOBILE_DESCRIPTION_PREVIEW_LENGTH : DESCRIPTION_PREVIEW_LENGTH;
            const shouldTruncate = item.desc.length > previewLength;
            const hasVeryLongDescription = item.desc.length > 420;
            const hasVeryLongTitle = item.name.length > 32;
            const isGamificationTitle = item.name === "Best Gamification Project";
            const descriptionText = shouldTruncate
              ? `${item.desc.slice(0, previewLength).trimEnd()}...`
              : item.desc;

            const isVisible = Math.abs(offset) <= 2 || Math.abs(offset) >= length - 2;
            if (!isVisible) return null;

            return (
              <div
                key={index}
                className="absolute w-full h-full transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer"
                style={{ transform, opacity, zIndex, pointerEvents: pointerEvents as "auto" | "none" }}
                onClick={() => {
                  if (offset !== 0) setCurrentIndex(index);
                }}
              >
                <div className="relative w-full h-full drop-shadow-2xl">
                  <div className={`absolute inset-0 transform ${index % 2 !== 0 ? "-scale-x-100" : ""}`}>
                    <Image
                      src={getPublicImageUrl(bubbleImg)}
                      alt="Bubble Background"
                      fill
                      className="object-contain mix-blend-multiply opacity-95 rounded-full"
                      unoptimized
                    />
                  </div>

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-10 md:p-14 text-center text-[#560700]">
                    <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-1 md:mb-3 opacity-90 mix-blend-color-burn">
                      {item.type}
                    </span>
                    <h3 className={`font-[family-name:var(--font-heading)] mb-2 sm:mb-4 px-2 leading-tight drop-shadow-sm w-full mx-auto break-words text-center ${isGamificationTitle ? "max-w-[84%] text-sm sm:text-lg md:text-2xl lg:text-3xl" : hasVeryLongTitle ? "max-w-[82%] text-sm sm:text-xl md:text-2xl lg:text-3xl" : hasVeryLongDescription ? "max-w-[90%] text-lg sm:text-2xl md:text-3xl lg:text-4xl" : "max-w-[90%] text-xl sm:text-3xl md:text-4xl lg:text-5xl"}`}>
                      {item.name}
                    </h3>
                    {(item.sponsor || item.prize) && <div className="flex flex-col gap-1 sm:gap-2 mb-2 sm:mb-5">
                      <span className="text-[10px] sm:text-xs md:text-sm font-bold mix-blend-color-burn">Sponsor: {item.sponsor}</span>
                      <span className="text-[10px] sm:text-sm font-bold text-[#560700] bg-white/50 px-3 sm:px-4 py-1 sm:py-2 rounded-full inline-block backdrop-blur-md shadow-sm border border-white/60">
                        Prize: {item.prize}
                      </span>
                    </div>}
                    {item.desc && <div className="max-w-[90%]">
                      <p className="font-[family-name:var(--font-body)] text-[10px] sm:text-xs md:text-sm lg:text-base leading-snug sm:leading-relaxed px-4 sm:px-8 mix-blend-color-burn">
                        {descriptionText}
                      </p>
                    </div>}
                    {shouldTruncate && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveDescriptionIndex(index);
                        }}
                        className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#560700] bg-white/45 hover:bg-white/60 px-3 py-1 rounded-full border border-white/60 transition-colors"
                        aria-label={`Read more for ${item.name}`}
                      >
                        Read more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nav Button Right */}
        <button
          onClick={handleNext}
          hidden={allPrizes.length < 2}
          className="z-50 p-2 sm:p-4 md:p-5 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-[#560700] transition-transform hover:scale-110 shadow-lg border border-white/30 flex-shrink-0"
          aria-label="Next Track"
        >
          <ChevronRight />
        </button>

      </div>

      {/* --- Decor Elements --- */}
      <div className="absolute top-[10%] sm:top-[12%] md:top-[10%] lg:top-[10%] xl:top-[8%] right-[5%] sm:right-[10%] w-[22%] sm:w-[16%] md:w-[12%] lg:w-[14%] xl:w-[15%] z-10 pointer-events-none">
        <FallingMascot
          src={getPublicImageUrl("track/trackBubbleMascot.png")}
          alt="Mascot in Bubble"
          fallDistance={300}
          duration={3.5}
          rotations={0.5}
          startScale={0.3}
          endScale={0.9}
          startRotateX={10}
          wobbleIntensity={15}
          triggerStart="top 80%"
          ease="power2.out"
          floatDistance={30}
          floatDuration={4}
        />
      </div>

      <div
        ref={smallBubbles1Ref}
        className="absolute top-[30%] left-[5%] lg:top-[25%] w-[35%] sm:w-[25%] md:w-[20%] z-10 pointer-events-none opacity-70"
      >
        <Image
          src={getPublicImageUrl("track/trackSmallBubbles1.png")}
          alt="Small Bubbles"
          width={200}
          height={400}
          className="w-full h-auto"
          unoptimized
        />
      </div>

      <div
        ref={smallBubbles2Ref}
        className="absolute bottom-[20%] right-[2%] sm:right-[3%] lg:right-[5%] w-[25%] sm:w-[20%] lg:w-[15%] z-10 pointer-events-none opacity-70"
      >
        <Image
          src={getPublicImageUrl("track/trackSmallBubbles2.png")}
          alt="Small Bubbles"
          width={200}
          height={350}
          className="w-full h-auto"
          unoptimized
        />
      </div>

      <div ref={reefsRef} className="absolute bottom-0 left-[-10%] md:left-[-2%] lg:left-[-2%] w-[160%] sm:w-[140%] md:w-full lg:w-full z-10 pointer-events-none origin-bottom">
        <Image
          src={getPublicImageUrl("track/trackReefs.png")}
          alt="Underwater Reefs"
          width={1920}
          height={300}
          className="w-full h-auto object-contain object-bottom"
          unoptimized
        />
      </div>

      {activeDescriptionIndex !== null && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={closeDescriptionModal}
        >
          <div
            className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border border-white/50 bg-white/80 p-6 sm:p-8 text-[#560700] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDescriptionModal}
              className="absolute right-4 top-4 rounded-full border border-[#560700]/30 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-white"
              aria-label="Close description modal"
            >
              Close
            </button>

            <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase opacity-90">
              {allPrizes[activeDescriptionIndex].type}
            </span>
            <h3 className="mt-2 pr-14 font-[family-name:var(--font-heading)] text-2xl sm:text-4xl leading-tight">
              {allPrizes[activeDescriptionIndex].name}
            </h3>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-xs sm:text-sm font-bold">Sponsor: {allPrizes[activeDescriptionIndex].sponsor}</span>
              <span className="text-xs sm:text-sm font-bold bg-white/60 px-4 py-2 rounded-full inline-block border border-white/70 w-fit">
                Prize: {allPrizes[activeDescriptionIndex].prize}
              </span>
            </div>
            <p className="mt-5 font-[family-name:var(--font-body)] text-sm sm:text-base leading-relaxed">
              {allPrizes[activeDescriptionIndex].desc}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
