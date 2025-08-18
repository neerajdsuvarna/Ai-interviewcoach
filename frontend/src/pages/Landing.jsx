import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/landing/Hero';
import FeatureHighlights from '../components/landing/FeatureHighlights';
import HowItWorks  from '../components/landing/HowItWorks';
import UseCases from '../components/landing/UseCases';
import FAQ from '../components/landing/FAQ';
import CallToAction from '../components/landing/CallToAction';

function Landing() {
  return (
    <>
      <Navbar />
      <Hero />
      <FeatureHighlights />
      <HowItWorks />
      <UseCases/>
      <FAQ/>
      <CallToAction/>
    </>
  );
}

export default Landing;
