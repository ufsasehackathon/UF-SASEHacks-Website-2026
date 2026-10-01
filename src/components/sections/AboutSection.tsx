"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getPublicImageUrl } from "@/lib/images";
import FallingMascot from "@/components/FallingMascot";

gsap.registerPlugin(ScrollTrigger);

const carouselImages = [
  { id: 1, src: getPublicImageUrl("/gbm-4-s25.jpg"), alt: "GBM 4" },
  { id: 2, src: getPublicImageUrl("/sase2.png"), alt: "Event Photo 2" },
  { id: 3, src: getPublicImageUrl("/sase1.png"), alt: "Event Photo 3" },
];

export default function AboutSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const aboutStackRef = useRef<HTMLDivElement>(null);
  const usStackRef = useRef<HTMLDivElement>(null);
  const shapeBlueRef = useRef<HTMLDivElement>(null);
  const shapeYellowRef = useRef<HTMLDivElement>(null);
  const shapeOrangeRef = useRef<HTMLDivElement>(null);
  const shapeGreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Floating block stacks
      gsap.to(aboutStackRef.current, {
        y: -20,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to(usStackRef.current, {
        y: -15,
        duration: 3,
        delay: 0.3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Shapes animation
      const shapes = [shapeBlueRef, shapeYellowRef, shapeOrangeRef, shapeGreenRef];
      shapes.forEach((ref, i) => {
        gsap.to(ref.current, {
          y: -20,
          duration: 2 + i * 0.3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Infinite scroll - repeat images
  const repeatedImages = [...carouselImages, ...carouselImages, ...carouselImages, ...carouselImages];

  return (
    <section
      id="about"
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden flex flex-col pt-0 pb-20"
    >
      {/* Carousel at top */}
      <div className="absolute top-0 left-0 right-0 h-32 sm:h-40 md:h-48 lg:h-64 overflow-hidden z-30 pb-4 sm:pb-6 md:pb-8 lg:pb-12">
        <div className="animate-scroll-horizontal h-full w-[4800px] flex">
          {repeatedImages.map((item, index) => (
            <div
              key={`carousel-${item.id}-${index}`}
              className="w-[300px] sm:w-[350px] md:w-[400px] h-full relative flex-shrink-0"
              style={{ marginRight: '-1px' }}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 640px) 300px, (max-width: 768px) 350px, 400px"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <Image
          src={getPublicImageUrl("about/aboutBackground.png") || "/placeholder.svg"}
          alt="Cloud Background"
          fill
          className="object-cover object-bottom"
          priority
          unoptimized
        />
      </div>

      {/* Floating shapes */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-start -space-y-5 translate-y-110 lg:translate-y-0 lg:block">
        {/* Yellow block */}
        <div ref={shapeYellowRef} className="relative lg:absolute lg:bottom-0 lg:left-[1%] w-24 md:w-32 ml-4 lg:ml-0">
          <Image src={getPublicImageUrl("about/aboutYellowBlock.png")} alt="Yellow" width={140} height={90} unoptimized />
        </div>
        {/* Blue block */}
        <div ref={shapeBlueRef} className="relative lg:absolute lg:bottom-0 lg:left-[12%] w-28 md:w-40 ml-4 lg:ml-0">
          <Image src={getPublicImageUrl("about/aboutBlueBlock.png")} alt="Blue" width={180} height={120} unoptimized />
        </div>
        {/* Orange block */}
        <div ref={shapeOrangeRef} className="relative lg:absolute lg:bottom-0 lg:left-[24%] w-20 md:w-28 ml-4 lg:ml-0">
          <Image src={getPublicImageUrl("about/aboutOrangeBlock.png")} alt="Orange" width={120} height={120} unoptimized />
        </div>
        {/* Green block */}
        <div ref={shapeGreenRef} className="relative lg:absolute lg:bottom-0 lg:left-[36%] w-16 md:w-24 ml-4 lg:ml-0">
          <Image src={getPublicImageUrl("about/aboutGreenBlock.png")} alt="Green" width={100} height={100} unoptimized />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 z-20 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-center flex-1 pt-36 sm:pt-48 md:pt-56 lg:pt-0">
        
        {/* text modal */}
        <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center lg:justify-start -translate-y-90 md:-translate-y-150 lg:translate-y-0">
          <div className="bg-white/90 backdrop-blur-sm p-8 md:p-10 rounded-[3rem] shadow-2xl border-4 border-white transform -rotate-1 max-w-lg z-30">
            <p className="font-[family-name:var(--font-body)] text-[#560700] text-lg md:text-xl leading-relaxed font-medium">
              SASEHacks is a 24 hour long hackathon where students make a project that
              solves a real world problem, showcases their technical creativity, and brings their
              unique perspective to life through code.
            </p>
          </div>
        </div>

        {/* About us blocks */}
        <div className="lg:col-span-7 relative h-[350px] sm:h-[500px] md:h-[600px] lg:h-[800px] w-full flex justify-center items-end order-1 lg:order-2">
          <div className="relative w-full max-w-[900px] h-full flex items-end justify-end pr-2 sm:pr-4 md:pr-8 pb-0">
            
            {/* About stack */}
            <div ref={aboutStackRef} className="relative z-20 w-[100%] md:w-[95%] mb-[-70%] md:mb-[-50%] lg:mb-[-11%] -mr-35 sm:-mr-40 md:-mr-20">
              <Image 
                src={getPublicImageUrl("about/aboutBlocks.png")} 
                alt="About Blocks" 
                width={2500} 
                height={3400} 
                className="w-full h-auto drop-shadow-xl"
                unoptimized
              />
            </div>

            {/* Us stack */}
            <div ref={usStackRef} className="relative z-20 w-[35%] md:w-[35%] mb-[-70%] md:mb-[-50%] lg:mb-[-12%] md:-ml-20">
              <div className="relative w-full">
                <Image 
                  src={getPublicImageUrl("about/usBlocks.png")} 
                  alt="Us Blocks" 
                  width={300} 
                  height={460} 
                  className="w-full h-auto drop-shadow-xl"
                  unoptimized
                />
                
                {/* Mascot */}
                <div 
                  className="absolute top-[-68%] md:top-[-72%] right-[-15%] md:right-[-15%] w-[125%] md:w-[130%] z-30 isolate drop-shadow-none"
                >
                  <FallingMascot
                    src={getPublicImageUrl("about/aboutMascot.png")}
                    alt="Shark Mascot"
                    fallDistance={500}
                    duration={2.5}
                    rotations={1}
                    startScale={0.3}
                    endScale={1}
                    startRotateX={45}
                    wobbleIntensity={20}
                    triggerStart="top 60%"
                    ease="power2.out"
                    floatDistance={12}
                    floatDuration={2.5}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-horizontal {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll-horizontal {
          animation: scroll-horizontal 25s linear infinite;
        }
      `}</style>
    </section>
  );
}