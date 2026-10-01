"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { getPublicImageUrl } from "@/lib/images";

interface TeamMember {
  name: string;
  position?: string;
  photo?: string;
  linkedin?: string;
}

interface SelectedMember {
  member: TeamMember;
  teamLabel: string;
}

interface PositionStyle {
  top: string;
  left: string;
  width: string;
  height: string;
}

interface Team {
  id: string;
  label: string;
  boxImage?: string;
  members: TeamMember[];
  labelPosition?: Partial<PositionStyle>;
  circlesPosition?: Partial<PositionStyle>;
  labelSize?: string;
  circleSize?: string;
}

const defaultLabelPosition: PositionStyle = {
  top: "31%",
  left: "14.5%",
  width: "24.5%",
  height: "10%",
};

const defaultCirclesPosition: PositionStyle = {
  top: "25%",
  left: "48.5%",
  width: "24.75%",
  height: "51%",
};

const defaultLabelSize = "text-3xl md:text-5xl lg:text-6xl";
const defaultCircleSize = "w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24";
const defaultGridCircleSize = "w-10 h-10 md:w-18 md:h-18 lg:w-24 lg:h-24";

const teams: Team[] = [
  {
    id: "director",
    label: "Director",
    boxImage: getPublicImageUrl("teams/elements/blueBox.png"),
    members: [
      { name: "Thuy Le", position: "Co-Director", linkedin: "https://www.linkedin.com/in/thuy-n-le/", photo: getPublicImageUrl("teams/director/thuy-le.jpg") },
      { name: "Lynette Hemingway", position: "Co-Director", linkedin: "https://www.linkedin.com/in/lynette-hemingway/", photo: getPublicImageUrl("teams/director/lynette-hemingway.jpg") },
    ],
    labelSize: "text-2xl md:text-5xl lg:text-6xl",
  },
  {
    id: "website",
    label: "Website",
    boxImage: getPublicImageUrl("teams/elements/blueBox.png"),
    members: [
      { name: "Vincent Lin", position: "Software Lead", linkedin: "https://www.linkedin.com/in/vincent-lin-uf/", photo: getPublicImageUrl("teams/website/vincent-lin.png") },
      { name: "Alex Nguyen", position: "Software Engineer", linkedin: "https://www.linkedin.com/in/alexander-nguyen-van/", photo: getPublicImageUrl("teams/website/alex-nguyen.jpg") },
      { name: "Nivedhaa Sankaran", position: "Software Engineer", linkedin: "https://www.linkedin.com/in/nivedhaa-sankaran/", photo: getPublicImageUrl("teams/website/nivedhaa-s.jpeg") },
    ],
    labelSize: "text-2xl md:text-5xl lg:text-6xl",
  },
  {
    id: "operations",
    label: "Operations",
    boxImage: getPublicImageUrl("teams/elements/purpleBox.png"),
    members: [
      { name: "Pryanna Pradhan", position: "Operations Lead", linkedin: "https://www.linkedin.com/in/pryanna-pradhan-178138346/", photo: getPublicImageUrl("teams/operation/pryanna-pradhan.jpg") },
      { name: "Frankie Lin", position: "Operations Coordinator", photo: getPublicImageUrl("teams/operation/frankie-lin.jpg") },
      { name: "Tiffany Chen", position: "Operations Coordinator", photo: getPublicImageUrl("teams/operation/tiffany-chen.jpg") },
      { name: "Alexander Ngov", position: "Operations Coordinator", photo: getPublicImageUrl("teams/operation/alexander-ngov.jpg") },
      { name: "Man Kai Andrew Ho", position: "Operations Coordinator", photo: getPublicImageUrl("teams/operation/andrew-ho.jpg") },
    ],
    labelSize: "text-xl md:text-4xl lg:text-5xl",
  },
  {
    id: "workshop",
    label: "Workshop",
    boxImage: getPublicImageUrl("teams/elements/greenBox.png"),
    members: [
      { name: "Michael Hemingway", position: "Workshop Lead", linkedin: "https://www.linkedin.com/in/michael-hemingway-uf/", photo: getPublicImageUrl("teams/workshop/michael-hemingway.jpg") },
      { name: "Taran Raj", position: "Workshop Coordinator", photo: getPublicImageUrl("teams/workshop/taran-raj.jpg") },
      { name: "Thomas Beegle", position: "Workshop Coordinator", photo: getPublicImageUrl("teams/workshop/thomas-beegle.jpg") },
      { name: "Ryan Xi", position: "Workshop Coordinator", photo: getPublicImageUrl("teams/workshop/ryan-xi.jpg") },
      { name: "Rishi Gandhi", position: "Workshop Coordinator", photo: getPublicImageUrl("teams/workshop/rishi-gandhi.jpg") },
    ],
    labelSize: "text-xl md:text-4xl lg:text-6xl",
  },
  {
    id: "merch",
    label: "Merch",
    boxImage: getPublicImageUrl("teams/elements/redBox.png"),
    members: [
      { name: "Savin Karki", position: "Merch Lead", linkedin: "https://www.linkedin.com/in/savin-karki/", photo: getPublicImageUrl("teams/merch/savin-karki.jpg") },
      { name: "Kyle Yumul", position: "Merch Coordinator", photo: getPublicImageUrl("teams/merch/kyle-yumul.jpg") },
      { name: "Angela Chen", position: "Merch Coordinator", photo: getPublicImageUrl("teams/merch/angela-chen.jpg") },
      { name: "Ariya Mouthapong", position: "Merch Coordinator", photo: getPublicImageUrl("teams/merch/ariya-mouthapong.jpg") },
    ],
  },
  {
    id: "award-judging",
    label: "Award/Judging",
    boxImage: getPublicImageUrl("teams/elements/yellowBox.png"),
    members: [
      { name: "Karen Liang", position: "Award/Judging Lead", linkedin: "https://www.linkedin.com/in/karen-z-liang/", photo: getPublicImageUrl("teams/award-judging/karen-liang.png") },
      { name: "Winnie Lin", position: "Award/Judging Coordinator", photo: getPublicImageUrl("teams/award-judging/winnie-lin.jpg") },
      { name: "Saaketh Kesireddy", position: "Award/Judging Coordinator", photo: getPublicImageUrl("teams/award-judging/saaketh-kesireddy.jpg") },
      { name: "Oscar Cao", position: "Award/Judging Coordinator", photo: getPublicImageUrl("teams/award-judging/oscar-cao.jpg") },
    ],
    labelSize: "text-sm md:text-3xl lg:text-4xl xl:text-5xl",
  },
];

const AUTO_ROTATE_INTERVAL = 4000;

export default function TeamsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const closeModal = useCallback(() => {
    setSelectedMember(null);
  }, []);

  const handleModalBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }, [closeModal]);

  const goToSlide = useCallback((index: number) => {
    let newIndex = index;
    if (index < 0) newIndex = teams.length - 1;
    if (index >= teams.length) newIndex = 0;
    setCurrentIndex(newIndex);
  }, []);

  const goToNext = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  const goToPrev = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  useEffect(() => {
    if (isPaused) {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
        autoRotateRef.current = null;
      }
      return;
    }

    autoRotateRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % teams.length);
    }, AUTO_ROTATE_INTERVAL);

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [isPaused]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    },
    [goToNext, goToPrev]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      touchStartX.current = e.clientX;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      const diff = touchStartX.current - e.clientX;
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          goToNext();
        } else {
          goToPrev();
        }
      }
    }
  };

  return (
    <section
      id="teams"
      className="relative w-full pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden bg-[#fec6e7]"
      aria-label="Meet Our Teams"
    >
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-80">
        <Image
          src={getPublicImageUrl("teams/elements/cloudElement.png")}
          alt=""
          width={1920}
          height={400}
          className="w-full h-auto object-cover"
          priority
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <h2 className="font-[family-name:var(--font-heading)] text-[#560700] text-5xl md:text-7xl text-center mb-8 drop-shadow-md">
          Meet Our Teams
        </h2>

        <div
          className="relative max-w-6xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsPaused(false);
            }
          }}
          onKeyDown={handleKeyDown}
          role="region"
          aria-roledescription="carousel"
          aria-label="Teams carousel"
        >
          <button
            onClick={goToPrev}
            className="absolute left-0 md:-left-12 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#D4728C] focus:ring-offset-2"
            aria-label="Previous team"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6 text-[#D4728C]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 md:-right-12 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#D4728C] focus:ring-offset-2"
            aria-label="Next team"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6 text-[#D4728C]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <div
            className="relative overflow-hidden mx-8 md:mx-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            tabIndex={0}
            role="group"
            aria-roledescription="slide"
            aria-label={`${currentIndex + 1} of ${teams.length}: ${teams[currentIndex].label} team`}
          >
            <div className="relative w-full" style={{ paddingBottom: "70%" }}>
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                    index === currentIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  aria-hidden={index !== currentIndex}
                >
                  <div className="relative w-full h-full">
                    <Image
                      src={team.boxImage || getPublicImageUrl("teams/elements/boxElement.png")}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 1000px"
                      priority={index === 0}
                    />

                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        ...defaultLabelPosition,
                        ...team.labelPosition,
                      }}
                    >
                      <span
                        className={`${team.labelSize || defaultLabelSize} font-bold text-center lowercase whitespace-pre-line leading-none`}
                        style={{
                          color: "#D4728C",
                          textShadow: "3px 3px 0 #fff, -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 0 3px 0 #fff, 0 -3px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff",
                          fontFamily: "var(--font-heading), cursive",
                        }}
                      >
                        {team.label}
                      </span>
                    </div>

                    <div
                      className="absolute flex flex-col items-center justify-center gap-2 md:gap-3"
                      style={{
                        ...defaultCirclesPosition,
                        ...team.circlesPosition,
                      }}
                    >
                      {(() => {
                        const isLeadOrDirector = (position?: string) =>
                          position?.toLowerCase().includes("director") || position?.toLowerCase().includes("lead");

                        const isGridLayout = team.members.length >= 4;
                        const circleSize = team.circleSize || (isGridLayout ? defaultGridCircleSize : defaultCircleSize);

                        const renderCircle = (member: TeamMember, key: number) => (
                          <button
                            key={key}
                            onClick={() => setSelectedMember({ member, teamLabel: team.label })}
                            className={`relative ${circleSize} rounded-full bg-pink-200 shadow-lg flex items-center justify-center overflow-hidden cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2`}
                            style={{ border: `4px solid ${isLeadOrDirector(member.position) ? "#D4728C" : "white"}` }}
                            aria-label={`View ${member.name}'s profile`}
                          >
                            {member.photo ? (
                              <Image src={member.photo} alt={member.name} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full bg-pink-100 flex items-center justify-center">
                                <svg className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-pink-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                              </div>
                            )}
                          </button>
                        );

                        if (team.members.length <= 2) {
                          return team.members.map((member, i) => renderCircle(member, i));
                        } else if (team.members.length === 4) {
                          return (
                            <div className="grid grid-cols-2 gap-1 md:gap-2 lg:gap-3">
                              {team.members.map((member, i) => renderCircle(member, i))}
                            </div>
                          );
                        } else if (team.members.length === 5) {
                          return (
                            <>
                              <div className="grid grid-cols-2 gap-1 md:gap-2 lg:gap-3">
                                {team.members.slice(0, 4).map((member, i) => renderCircle(member, i))}
                              </div>
                              {renderCircle(team.members[4], 4)}
                            </>
                          );
                        } else {
                          return team.members.map((member, i) => renderCircle(member, i));
                        }
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex justify-center gap-3 md:gap-4 mt-6 md:mt-8"
            role="tablist"
            aria-label="Carousel navigation"
          >
            {teams.map((team, index) => (
              <button
                key={team.id}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#D4728C] focus:ring-offset-2 ${
                  index === currentIndex
                    ? "bg-[#D4728C] scale-125 shadow-md"
                    : "bg-[#D4728C]/30 hover:bg-[#D4728C]/50"
                }`}
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Go to ${team.label} team (slide ${index + 1} of ${teams.length})`}
                tabIndex={index === currentIndex ? 0 : -1}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={handleModalBackdropClick}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-sm w-[90%] mx-4 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <p
              className="text-2xl md:text-3xl font-bold text-center mb-4 lowercase"
              style={{
                color: "#D4728C",
                textShadow: "2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff",
                fontFamily: "var(--font-heading), cursive",
              }}
            >
              {selectedMember.teamLabel}
            </p>

            <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 rounded-full overflow-hidden bg-pink-200 shadow-lg" style={{ border: "4px solid white" }}>
              {selectedMember.member.photo ? (
                <Image
                  src={selectedMember.member.photo}
                  alt={selectedMember.member.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-pink-100 flex items-center justify-center">
                  <svg className="w-12 h-12 md:w-16 md:h-16 text-pink-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>

            <h3 className="text-xl md:text-2xl font-bold text-gray-800 text-center mb-1">
              {selectedMember.member.name}
            </h3>

            {selectedMember.member.position && (
              <p className="text-gray-500 text-center mb-4">
                {selectedMember.member.position}
              </p>
            )}

            {selectedMember.member.linkedin && (
              <a
                href={selectedMember.member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
