// Login.tsx (Block Component)
"use client";
import { motion, AnimatePresence } from "framer-motion"; // Changed to "framer-motion" for standard Next.js
import { useState, useEffect, MutableRefObject, useRef } from "react";

interface blockProps {
    x?: number;
    y?: number;
    iconSrc?: string; // Made optional
    text?: string;    // Added text prop
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
                    // NOTE: If your text blocks are wider, you might need to increase blockWidth for collision!
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

    return (
        <motion.div 
            // If it has text, make it wider (w-[15%]) and let height adjust. If icon, keep it a square (aspect-square w-[5%])
            className={`absolute flex cursor-pointer -translate-x-1/2 -translate-y-1/2 z-10 ${text ? 'w-[15%] h-[8%]' : 'aspect-square w-[5%]'}`}
            style={{ top: `${y}%`, left: `${x}%` }}
        >
            <AnimatePresence>
                {realHits < 2 && (
                    <motion.div 
                        className="h-full w-full relative overflow-hidden bg-white shadow-lg border-4 border-gray-800 flex items-center justify-center p-1 md:p-2" 
                        animate={realisHit ? { y: [0, -20, 0] } : { y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -50, filter: "blur(10px)" }} 
                        transition={{ duration: 0.3, ease: "anticipate" }}
                        onAnimationComplete={() => setrealIsHit(false)}
                    >
                        {/* CONDITIONAL RENDERING: Icon vs Text */}
                        {iconSrc ? (
                            <img src={iconSrc} alt="Provider" className="w-full h-full object-contain pointer-events-none" />
                        ) : (
                            <span className="text-[10px] md:text-sm font-bold text-center leading-tight pointer-events-none text-black select-none">
                                {text}
                            </span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}