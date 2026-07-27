/** Text only for now — a call-to-action button would link to search or a
 * destination, and neither exists until a later milestone. A decorative
 * button that does nothing is worse than no button. */
export function HeroSection() {
  return (
    <div className="py-20 text-center sm:py-28">
      <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
        Discover the North Coast
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
        Find destinations, restaurants, cafes, and beaches along Egypt&apos;s
        North Coast.
      </p>
    </div>
  );
}
