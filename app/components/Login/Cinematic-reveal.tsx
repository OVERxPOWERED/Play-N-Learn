"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface CinematicProps {
    heading: string;
}

export default function CinematicReveal({ heading }: CinematicProps) {
    // 1. Add a state to track if we are on a mobile screen
    const [isMobile, setIsMobile] = useState(false);

    // 2. Check the window width when the component mounts
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768); // 768px is Tailwind's 'md' breakpoint
        checkMobile(); // Run once on load
        
        // Optional: Update if the user resizes their window
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        // 'fixed inset-0' makes it global, covering the entire browser window.
        // 'pointer-events-none' ensures you can play the game once the black fades.
        // Note: Swapped z-100 to z-[100] to ensure Tailwind compiles it correctly!
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden flex items-center justify-center">

            {/* 1. The Global Black Background */}
            <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 1 }}
                animate={{ 
                    opacity: [1, 1, 0] // 1. Solid black, 2. Hold solid black, 3. Fade to transparent
                }}
                transition={{
                    duration: 2, // Total animation time
                    // 0 to 0.4 (40% of time) = Hold. 0.4 to 1.0 = Fade out.
                    times: [0, 0.4, 1], 
                    ease: "easeInOut"
                }}
            />

            {/* 2. The Single Moving Text */}
            <motion.div
                className="absolute text-white font-mono font-bold z-[101] [-webkit-text-stroke:2px_black]"
                initial={{
                    top: "50%",
                    left: "50%",
                    x: "-50%",
                    y: "-50%",
                    scale: 1.5
                }}
                animate={{
                    // 3. THE MAGIC: Use the isMobile state to dynamically set the final top position!
                    top: ["50%", "50%", isMobile ? "5%" : "10%"],   
                    left: ["50%", "50%", "7%"],  
                    
                    // Removes the centering offset so it sits flush in the corner
                    x: ["-50%", "-50%", "0%"],   
                    y: ["-50%", "-50%", "0%"],
                    
                    // Shrinks from 1.5x down to normal size
                    scale: [1.5, 1.5, 1],        
                }}
                transition={{
                    duration: 2, 
                    times: [0, 0.4, 1], // Exactly synced with the background fade!
                    ease: "easeInOut"
                }}
            >
                {/* The tracking-wider class helps it look more cinematic */}
                <h1 className="text-6xl md:text-8xl drop-shadow-md tracking-wider">{heading}</h1>
            </motion.div>

        </div>
    );
}