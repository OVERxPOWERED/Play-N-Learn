"use client";
import { motion } from "framer-motion";

interface CinematicProps {
    heading: string;
}

export default function CinematicReveal({ heading }: CinematicProps) {
    return (
        // 'fixed inset-0' makes it global, covering the entire browser window.
        // 'pointer-events-none' ensures you can play the game once the black fades.
        <div className="fixed inset-0 z-100 pointer-events-none overflow-hidden flex items-center justify-center">

            {/* 1. The Global Black Background */}
            <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 1 }}
                animate={{ 
                    opacity: [1, 1, 0] // 1. Solid black, 2. Hold solid black, 3. Fade to transparent
                }}
                transition={{
                    duration: 4, // Total animation time
                    // 0 to 0.4 (40% of time) = Hold. 0.4 to 1.0 = Fade out.
                    times: [0, 0.4, 1], 
                    ease: "easeInOut"
                }}
            />

            {/* 2. The Single Moving Text */}
            <motion.div
                className="absolute text-white font-mono font-bold z-101 [-webkit-text-stroke:2px_black]"
                initial={{
                    top: "50%",
                    left: "50%",
                    x: "-50%",
                    y: "-50%",
                    scale: 1.5
                }}
                animate={{
                    // Moves from Center (50%) to Top-Left (5%)
                    top: ["50%", "50%", "5%"],   
                    left: ["50%", "50%", "5%"],  
                    
                    // Removes the centering offset so it sits flush in the corner
                    x: ["-50%", "-50%", "0%"],   
                    y: ["-50%", "-50%", "0%"],
                    
                    // Shrinks from 1.5x down to normal size
                    scale: [1.5, 1.5, 1],        
                }}
                transition={{
                    duration: 4, 
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