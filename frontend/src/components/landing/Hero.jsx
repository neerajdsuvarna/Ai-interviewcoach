import React from 'react';
import Button from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';

function Hero() {
  const { isDark } = useTheme();

  const heroImage = isDark
    ? '/assets/landing/hero/hero-dark.png'
    : '/assets/landing/hero/hero-light.png';

  return (
    <section className="relative pt-32 pb-28 md:pt-36 md:pb-32 bg-[var(--color-bg)] text-[var(--color-text-primary)] overflow-hidden">
      
      {/* Soft Gradient Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-accent)]/10 to-transparent dark:from-[var(--color-primary)]/20 dark:via-[var(--color-accent)]/20 blur-3xl opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        
        {/* LEFT TEXT SIDE WITH ANIMATION */}
        <motion.div
          className="text-center md:text-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Your <span className="text-[var(--color-primary)]">AI-Powered</span><br className="hidden sm:inline" /> Interview Coach
          </h1>

          <p className="text-lg text-[var(--color-text-secondary)] mb-10 max-w-xl mx-auto md:mx-0">
            Upload your resume and job description. Get tailored questions and practice real interviews with AI — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4">
            <Button to="/upload" variant="primary">Try It Now</Button>
            <Button to="/features" variant="secondary">Learn More</Button>
          </div>
        </motion.div>

        {/* RIGHT IMAGE WITH SMOOTH TRANSITION AND GLOW */}
        <div className="hidden md:flex justify-center relative z-10">
          {/* Animated Glow Effect */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[var(--color-primary)] rounded-full blur-3xl opacity-20 z-[-1]"
            animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Main Image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={heroImage}
              src={heroImage}
              alt="Interview Coach Preview"
              className="w-full max-w-[640px] xl:max-w-[720px] drop-shadow-xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export default Hero;
