import { HeroSection } from '@/components/sections/HeroSection';
import { ModulesSection } from '@/components/sections/ModulesSection';
import { AISection } from '@/components/sections/AISection';
import { RoadmapSection } from '@/components/sections/RoadmapSection';
import { Navbar } from '@/components/layout/Navbar';
import { StatusBar } from '@/components/layout/StatusBar';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <ModulesSection />
        <AISection />
        <RoadmapSection />
      </main>
      <StatusBar />
    </>
  );
}
