import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "How does the platform personalize interview questions?",
    answer:
      "Our AI analyzes your resume and the job description to generate questions tailored to your background and the role’s requirements.",
  },
  {
    question: "Is this suitable for non-technical roles?",
    answer:
      "Yes! While we support technical interviews, we also cover behavioral and role-specific questions for marketing, HR, finance, and more.",
  },
  {
    question: "Can I use this on my phone?",
    answer:
      "Absolutely. The platform is fully responsive and optimized for mobile use, so you can practice interviews anywhere.",
  },
  {
    question: "Is there a free version?",
    answer:
      "Yes, we offer a free tier with limited access. For full features like unlimited mock sessions and premium analytics, upgrade to Pro.",
  },
];

export default function FAQ() {
  const [openIndices, setOpenIndices] = useState([]);

  const toggle = (index) => {
    setOpenIndices((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <section className="py-28 px-6 sm:px-8 lg:px-16 bg-[var(--color-bg)] transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-4xl sm:text-5xl font-bold tracking-tight text-[var(--color-text-primary)] mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-12">
          Everything you need to know about the platform, from features to support.
        </p>

        <div className="space-y-5">
          {faqs.map((faq, index) => {
            const isOpen = openIndices.includes(index);
            return (
              <motion.div
                key={index}
                layout
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-shadow hover:shadow-lg"
              >
                <button
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none focus:ring-0 focus:ring-offset-0"
                >
                  <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[var(--color-text-secondary)] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.section
                      key="content"
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-5 text-[var(--color-text-secondary)] text-base leading-relaxed"
                    >
                      {faq.answer}
                    </motion.section>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
