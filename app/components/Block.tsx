


// // Block.tsx
// "use client";
// import { motion, AnimatePresence } from "motion/react";
// import { useState, useEffect, MutableRefObject, useRef } from "react";

// interface blockProps {
//     x?: number;
//     y?: number;
//     iconSrc: string; // <-- NEW: Pass the provider's icon
//     onBreak: () => void; // <-- NEW: What happens when it breaks?
//     playerState?: MutableRefObject<{
//         isJumping: boolean;
//         playerXpos: number;
//     }>;
// }

// export default function Block({ x = 0, y = 0, iconSrc, onBreak, playerState }: blockProps) {
//     const [realisHit, setrealIsHit] = useState(false);
//     const [realHits, setRealHits] = useState(0);
//     const previousJumpState = useRef(false);
//     const realHitsRef = useRef(0);

//     useEffect(() => {
//         let animationFrameId: number;
        
//         const checkCollision = () => {
//             if (playerState && playerState.current) {
//                 const { isJumping, playerXpos } = playerState.current;

//                 if (isJumping && !previousJumpState.current) {
//                     const playerWidth = 5;  
//                     const blockWidth = 10;  
//                     const touchingBlock = playerXpos < x + (blockWidth / 2) && playerXpos + playerWidth > x - (blockWidth / 2);

//                     if (touchingBlock && realHitsRef.current < 2) {
//                         setTimeout(() => {
//                             realHitsRef.current += 1;
//                             setRealHits(realHitsRef.current);
//                             setrealIsHit(true);
                            
//                             // WHEN BROKEN: Call the function passed from the parent!
//                             if (realHitsRef.current >= 2) {
//                                 setTimeout(() => {
//                                     onBreak(); 
//                                 }, 300); // Slight delay for the breaking animation
//                             }
//                         }, 150); 
//                     }
//                 }
//                 previousJumpState.current = isJumping;
//             }
//             animationFrameId = requestAnimationFrame(checkCollision);
//         };

//         animationFrameId = requestAnimationFrame(checkCollision);
//         return () => cancelAnimationFrame(animationFrameId);
//     }, [playerState, x, onBreak]);

//     return (
//         <motion.div 
//             className="h-16 w-16 absolute flex cursor-pointer -translate-x-1/2 -translate-y-1/2 z-10" 
//             style={{ top: `${y}%`, left: `${x}%` }}
//         >
//             <AnimatePresence>
//                 {realHits < 2 && (
//                     <motion.div 
//                         className="h-full w-full relative overflow-hidden bg-white rounded-xl shadow-lg border-4 border-gray-800 flex items-center justify-center p-2" 
//                         animate={realisHit ? { y: [0, -20, 0] } : { y: 0 }}
//                         exit={{ opacity: 0, scale: 0.5, y: -50, filter: "blur(10px)" }} // Cool shatter effect
//                         transition={{ duration: 0.3, ease: "anticipate" }}
//                         onAnimationComplete={() => setrealIsHit(false)}
//                     >
//                         {/* Display the specific provider icon here */}
//                         <img src={iconSrc} alt="Login Provider" className="w-full h-full object-contain pointer-events-none" />
//                     </motion.div>
//                 )}
//             </AnimatePresence>
//         </motion.div>
//     );
// }






// Block.tsx
"use client";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, MutableRefObject, useRef } from "react";

interface blockProps {
    x?: number;
    y?: number;
    iconSrc: string; 
    onBreak: () => void; 
    playerState?: MutableRefObject<{
        isJumping: boolean;
        playerXpos: number;
    }>;
}

export default function Block({ x = 0, y = 0, iconSrc, onBreak, playerState }: blockProps) {
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
                    const blockWidth = 10;  
                    const touchingBlock = playerXpos < x + (blockWidth / 2) && playerXpos + playerWidth > x - (blockWidth / 2);

                    if (touchingBlock && realHitsRef.current < 2) {
                        setTimeout(() => {
                            realHitsRef.current += 1;
                            setRealHits(realHitsRef.current);
                            setrealIsHit(true);
                            
                            // WHEN BROKEN: Trigger NextAuth via the parent's function
                            if (realHitsRef.current >= 2) {
                                setTimeout(() => {
                                    onBreak(); 
                                }, 300); // Slight delay so the user sees the shatter animation
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
    }, [playerState, x, onBreak]);

    return (
        <motion.div 
            className="h-16 w-16 absolute flex cursor-pointer -translate-x-1/2 -translate-y-1/2 z-10" 
            style={{ top: `${y}%`, left: `${x}%` }}
        >
            <AnimatePresence>
                {realHits < 2 && (
                    <motion.div 
                        className="h-full w-full relative overflow-hidden bg-white rounded-xl shadow-lg border-4 border-gray-800 flex items-center justify-center p-2" 
                        animate={realisHit ? { y: [0, -20, 0] } : { y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -50, filter: "blur(10px)" }} // Shatter effect
                        transition={{ duration: 0.3, ease: "anticipate" }}
                        onAnimationComplete={() => setrealIsHit(false)}
                    >
                        {/* Renders the online CDN icon */}
                        <img src={iconSrc} alt="Login Provider" className="w-full h-full object-contain pointer-events-none" />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}