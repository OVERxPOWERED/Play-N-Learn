"use client";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

export default function CinematicReveal() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Unmount after the animation finishes
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2500); 
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed z-[100] pointer-events-none rounded-full bg-transparent"
                    style={{
                        left: "5vw",
                        bottom: "40%",
                        // Centers the circle exactly on that coordinate
                        transform: "translate(-50%, 50%)", 
                        
                        // THE FIX: Layered Box Shadows for a perfect gradient
                        // 1. 'inset 0 0 60px black' -> Fades the inside edge of the circle
                        // 2. '0 0 100px 40px black' -> Creates the soft blurry gradient outside the circle
                        // 3. '0 0 0 150vmax black' -> The giant solid black wall that covers the screen
                        boxShadow: `
                            inset 0 0 60px black, 
                            0 0 100px 40px black, 
                            0 0 0 150vmax black
                        `
                    }}
                    
                    initial={{ 
                        width: "100px", 
                        height: "100px",
                        opacity: 1
                    }}
                    
                    animate={{ 
                        width: "300vmax", 
                        height: "300vmax",
                        opacity: 1
                    }}
                    
                    transition={{ 
                        duration: 1.5, 
                        delay: 0, 
                        ease: "easeInOut" 
                    }}
                    
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                />
            )}
        </AnimatePresence>
    );
}