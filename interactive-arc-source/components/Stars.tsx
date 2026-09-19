"use client";
import { useEffect, useRef } from "react";

export default function Stars() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", resize);
        resize();

        // Generate stars matching the logic from orbitb.html
        const stars = Array.from({ length: 3000 }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.5 + 0.3,
            color: Math.random() > 0.8 ? '#ffcc99' : (Math.random() > 0.6 ? '#99ccff' : '#ffffff'), //[cite: 4]
            a: Math.random() * 0.8 + 0.2,
            twinkle: Math.random() * Math.PI * 2
        }));

        let animationId: number;

        const draw = (time: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const star of stars) {
                // Apply the exact twinkle pulse calculation
                const pulse = 0.6 + 0.4 * Math.sin(time * 0.0016 + star.twinkle); //[cite: 4]
                
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                ctx.globalAlpha = star.a * pulse;
                ctx.fillStyle = star.color;
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
            animationId = requestAnimationFrame(draw);
        };

        animationId = requestAnimationFrame(draw);
        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-[#02050a]" />;
}