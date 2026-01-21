import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { QuickStart } from "@/components/landing/quick-start";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CTA } from "@/components/landing/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <QuickStart />
      <CTA />
    </>
  );
}
