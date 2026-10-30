import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import TracksSection from "@/components/sections/TracksSection";
import ScheduleSection from "@/components/sections/ScheduleSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import FaqSection from "@/components/sections/FaqSection";
import { fetchFaqFromGoogleDoc } from "@/lib/googleDocs";

// Re-fetch the FAQ doc at most every 10 minutes.
export const revalidate = 600;

export default async function Page() {
  const faqItems = await fetchFaqFromGoogleDoc();

  return (
    <>
      <HeroSection />
      <AboutSection />
      <TracksSection />
      <ScheduleSection />
      <SponsorsSection />
      <FaqSection faqItems={faqItems} />
    </>
  );
}
