import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import TracksSection from "@/components/sections/TracksSection";
import TeamsSection from "@/components/sections/TeamsSection";
import ScheduleSection from "@/components/sections/ScheduleSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import PartnersSections from "@/components/sections/PartnersSections";

export default function Page() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <TracksSection />
      <ScheduleSection />
      <SponsorsSection />
      <TeamsSection />
      <PartnersSections />
    </>
  );
}
