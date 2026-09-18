import Image from "next/image";
import FibreArc from "@/components/FibreArc"; // Adjust path if you placed it in /components instead

export default function Home() {
  return (
    <div className="relative min-h-screen w-full font-sans bg-black overflow-hidden">
      
      {/* Background Interactive Canvas */}
      <div className="absolute inset-0 z-0">
        <FibreArc 
          accentColor="#FF3366" 
          density={30} 
        />
      </div>

      {/* Foreground Content */}
      <main className="relative z-10 flex min-h-screen w-full max-w-3xl flex-col items-center justify-center mx-auto py-32 px-16 sm:items-start text-white">
        <Image
          className="invert h-5 w-[100px] mb-12"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-zinc-50">
            To get started, edit the{" "}
            <code className="rounded bg-white/[.15] px-1.5 py-0.5 font-mono text-[0.9em]">
              page.tsx
            </code>{" "}
            file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js"
              className="font-medium text-white hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn"
              className="font-medium text-white hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row mt-12">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-black transition-colors hover:bg-zinc-200 md:w-[158px]"
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-white/[.2] px-5 transition-colors hover:bg-white/[.1] md:w-[158px]"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}