import React from "react";
import Header from "../../components/layout/Header";

import HeroSection from "../../components/home/HeroSection";
import StatsSection from "../../components/home/StatsSection";
import WhyChooseUsSection from "../../components/home/WhyChooseUsSection";
import OurFeatureSection from "../../components/home/OurFeatureSection";
import CTASection from "../../components/home/CTASection";
import FAQs from "../../components/home/FAQs";

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <WhyChooseUsSection />
      <OurFeatureSection />
      <FAQs/>
      <CTASection />
    </>
  );
}
