import React from "react";

interface Logo {
  src: string;
  alt: string;
  gradient: {
    from: string;
    via: string;
    to: string;
  };
}

interface MarqueeLogoScrollerProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description: string;
  logos: Logo[];
  speed?: "normal" | "slow" | "fast";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MarqueeLogoScroller = React.forwardRef<HTMLElement, MarqueeLogoScrollerProps>(
  ({ title, description, logos, speed = "normal", className, ...props }, ref) => {
    const durationMap = {
      normal: "40s",
      slow: "80s",
      fast: "14s",
    };
    const animationDuration = durationMap[speed];

    return (
      <>
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>

        <section
          ref={ref}
          aria-label={title}
          className={cn(
            "w-full overflow-hidden rounded-[32px] border border-[rgba(8,31,92,0.14)] bg-[var(--color-paper-white)] text-[var(--color-galaxy)]",
            className
          )}
          {...props}
        >
          <div className="p-6 md:p-8 lg:p-10">
            <div className="grid grid-cols-1 gap-5 border-b border-[rgba(8,31,92,0.16)] pb-6 md:pb-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
              <h2 className="m-0 text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
                {title}
              </h2>
              <p className="m-0 max-w-xl text-sm font-medium leading-snug text-[var(--color-slate)] text-balance lg:justify-self-end">
                {description}
              </p>
            </div>
          </div>

          <div
            className="w-full overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div
              className="flex w-max items-center gap-4 py-4 pr-4 transition-all duration-300 ease-in-out hover:[animation-play-state:paused]"
              style={{
                animation: `marquee ${animationDuration} linear infinite`,
              }}
            >
              {[...logos, ...logos].map((logo, index) => {
                const isBluLogo = logo.alt === "Blu";
                const isFormacionIntegralLogo = logo.alt === "Formacion Integral";
                const isLunarLogo = logo.alt === "Lunar";

                return (
                  <div
                    key={`${logo.alt}-${index}`}
                    className="relative flex h-24 w-40 shrink-0 items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt={logo.alt}
                      className={cn(
                        "w-auto object-contain drop-shadow-[0_10px_16px_rgba(8,31,92,0.24)] transition-transform duration-300 ease-out",
                        isBluLogo
                          ? "h-full scale-[1.16] hover:scale-[1.22]"
                          : isLunarLogo
                          ? "h-full scale-[1.28] hover:scale-[1.34]"
                          : "h-3/4 hover:scale-105",
                        isFormacionIntegralLogo && "brightness-0"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </>
    );
  }
);

MarqueeLogoScroller.displayName = "MarqueeLogoScroller";

export { MarqueeLogoScroller };
