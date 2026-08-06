import { HeroSection } from '@/components/sections/HeroSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { ModulesSection } from '@/components/sections/ModulesSection';
import { AISection } from '@/components/sections/AISection';
import { RoadmapSection } from '@/components/sections/RoadmapSection';
import { Navbar } from '@/components/layout/Navbar';
import { StatusBar } from '@/components/layout/StatusBar';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <HowItWorksSection />
        <ModulesSection />
        <AISection />
        <RoadmapSection />
      </main>
      <Footer />
      <StatusBar />
    </>
  );
}
