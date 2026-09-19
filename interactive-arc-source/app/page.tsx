import FibreArc from "@/components/FibreArc";
import Stars from "@/components/Stars";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full font-sans overflow-hidden bg-[#02050a]">
      
      {/* Layer 1: The twinkling stars background */}
      <div className="absolute inset-0 z-0">
        <Stars />
      </div>

      {/* Layer 2: Interactive Arc (mix-blend-screen hides the black background) */}
      <div className="absolute inset-0 z-10 mix-blend-screen">
        <FibreArc 
          background="#000000" // Must be pure black for the blend mode to work
          accentColor="#FF3366" 
          density={30} 
        />
      </div>

      {/* Layer 3: Foreground Content (Your custom text goes here) */}
      {/* pointer-events-none lets mouse movements pass through to the arc */}
      <main className="relative z-20 flex min-h-screen w-full max-w-3xl flex-col items-center justify-center mx-auto py-32 px-16 sm:items-start text-white pointer-events-none">
        
        {/* pointer-events-auto makes the text and buttons clickable again */}
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left pointer-events-auto">
          <h1 className="max-w-md text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
            Welcome to Projection
          </h1>
          <p className="max-w-md text-xl leading-8 text-zinc-300 drop-shadow">
            This is where you replace the default Next.js instructions with your own description, portfolio details, or introductory text.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row mt-12 pointer-events-auto">
          <a
            className="flex h-12 w-full items-center justify-center rounded-full bg-white px-8 text-black transition-colors hover:bg-zinc-200"
            href="#"
          >
            Explore Work
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-white/[.3] px-8 transition-colors hover:bg-white/[.15] hover:backdrop-blur-sm"
            href="#"
          >
            Contact Me
          </a>
        </div>
      </main>
    </div>
  );
}