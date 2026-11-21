"use client";
import { motion, AnimatePresence } from "framer-motion"; 
import { useState, useEffect, MutableRefObject, useRef } from "react";

interface blockProps {
    x?: number;
    y?: number;
    iconSrc?: string; 
    text?: string;    
    onBreak: () => void; 
    playerState?: MutableRefObject<{
        isJumping: boolean;
        playerXpos: number;
    }>;
}

export default function Login({ x = 0, y = 0, iconSrc, text, onBreak, playerState }: blockProps) {
    const [realisHit, setrealIsHit] = useState(false);
    const [realHits, setRealHits] = useState(0);
    const previousJumpState = useRef(false);
    const realHitsRef = useRef(0);

    useEffect(() => {
        let animationFrameId: number;
        
        const checkCollision = () => {
            if (playerState && playerState.current) {
                const { isJumping, playerXpos } = playerState.current;

                if (isJumping && !previousJumpState.current) {
                    const playerWidth = 5;  
                    
                    // Hitbox logic: Averages the mobile and desktop sizes for consistent gameplay
                    const blockWidth = text ? 15 : 10;  
                    
                    const touchingBlock = playerXpos < x + (blockWidth / 2) && playerXpos + playerWidth > x - (blockWidth / 2);

                    if (touchingBlock && realHitsRef.current < 2) {
                        setTimeout(() => {
                            realHitsRef.current += 1;
                            setRealHits(realHitsRef.current);
                            setrealIsHit(true);
                            
                            if (realHitsRef.current >= 2) {
                                setTimeout(() => {
                                    onBreak(); 
                                }, 300); 
                            }
                        }, 150); 
                    }
                }
                previousJumpState.current = isJumping;
            }
            animationFrameId = requestAnimationFrame(checkCollision);
        };

        animationFrameId = requestAnimationFrame(checkCollision);
        return () => cancelAnimationFrame(animationFrameId);
    }, [playerState, x, text, onBreak]);

    // --- THE VISUAL FIX ---
    // Text Blocks: w-[18%] on mobile (max size without overlapping), shrinks to w-[10%] on desktop so it's not a massive empty square.
    // Icon Blocks: w-[12%] on mobile, shrinks to w-[6%] on desktop.
    const blockSizingClasses = text 
        ? "aspect-square w-[18%] md:w-[12%] lg:w-[9%]" 
        : "aspect-square w-[12%] md:w-[8%] lg:w-[5%]";

    return (
        <motion.div 
            className={`absolute flex cursor-pointer -translate-x-1/2 -translate-y-1/2 z-10 ${blockSizingClasses}`}
            style={{ top: `${y}%`, left: `${x}%` }}
        >
            <AnimatePresence>
                {realHits < 2 && (
                    <motion.div 
                        className="h-full w-full relative overflow-hidden bg-white shadow-lg border-[3px] md:border-4 border-[#2c2c2c] flex items-center justify-center p-1 md:p-2" 
                        animate={realisHit ? { y: [0, -20, 0] } : { y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -50, filter: "blur(10px)" }} 
                        transition={{ duration: 0.3, ease: "anticipate" }}
                        onAnimationComplete={() => setrealIsHit(false)}
                    >
                        {iconSrc ? (
                            <img src={iconSrc} alt="Provider" className="w-full h-full object-contain pointer-events-none" />
                        ) : (
                            // Increased lg:text-xs to lg:text-sm so the text fills the new 9% block better!
                            <span className="text-[10px] md:text-xs lg:text-sm font-bold text-center leading-tight pointer-events-none text-[#2c2c2c] select-none break-words w-full px-1">
                                {text}
                            </span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}