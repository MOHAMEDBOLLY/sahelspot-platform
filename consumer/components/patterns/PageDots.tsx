type PageDotsProps = {
  count: number;
  activeIndex: number;
};

/** Onboarding's slide indicator — distinct from Venue Details' numeric "1/15"
 * gallery counter (`Pill variant="counter"`), which is a different component
 * for a different purpose. Active dot elongates to a pill; inactive stay
 * round grey dots. */
export function PageDots({ count, activeIndex }: PageDotsProps) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <span
          className={`h-2 rounded-full transition-all ${
            index === activeIndex ? "w-6 bg-primary" : "w-2 bg-outline-variant"
          }`}
          key={index}
        />
      ))}
    </div>
  );
}
