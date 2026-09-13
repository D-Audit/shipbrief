type LandingHeroVisualProps = {
  videoSrc?: string;
  posterSrc?: string;
};

/** A quiet product-loop video that lets the workspace speak for itself. */
export function LandingHeroVisual({
  videoSrc = "/videos/ship.mp4",
  posterSrc = "/images/shipbrief-workspace-hero-v4.png",
}: LandingHeroVisualProps) {
  return (
    <figure className="relative min-h-[22rem] overflow-hidden rounded-[1.5rem] border border-border bg-white shadow-[0_24px_58px_rgb(31_32_35/0.11)] sm:aspect-[1.18/1] sm:min-h-[27rem] lg:min-h-[34rem]">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={posterSrc}
        aria-label="Looping preview of the ShipBrief release workspace"
        className="absolute inset-0 size-full object-cover object-center"
      >
        <source src={videoSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/25 to-transparent" />
    </figure>
  );
}
