export default function CallToAction() {
  return (
    <section className="bg-[var(--color-primary)] text-white py-20 px-6 sm:px-8 lg:px-16">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          Ready to Ace Your Next Interview?
        </h2>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
          Start practicing with AI-powered mock interviews tailored to your dream job.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="/signup"
            className="bg-white text-[var(--color-primary)] font-semibold px-6 py-3 rounded-xl transition hover:bg-gray-100"
          >
            Get Started Free
          </a>
          <a
            href="/features"
            className="border border-white font-semibold px-6 py-3 rounded-xl transition hover:bg-white hover:text-[var(--color-primary)]"
          >
            Explore Features
          </a>
        </div>
      </div>
    </section>
  );
}
