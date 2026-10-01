import { FAQ_ITEMS } from "@/lib/faq";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import TracksSection from "@/components/sections/TracksSection";
import TeamsSection from "@/components/sections/TeamsSection";
import ScheduleSection from "@/components/sections/ScheduleSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import PartnersSections from "@/components/sections/PartnersSections";
import FaqSection from "@/components/sections/FaqSection";

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
      <FaqSection faqItems={FAQ_ITEMS} />
    </>
  );
}
