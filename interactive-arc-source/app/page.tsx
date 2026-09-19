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
          background="#000000" 
          accentColor="#FF3366" 
          density={30} 
        />
      </div>
    </div>
  );
}