'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion' // <-- ADDED FRAMER MOTION
import Player from './Player'
import Login from './Login'

interface EnvironmentProps {
    currentStage: string;
    onStageChange: (newStage: string) => void;
}

const LOGIN_PROVIDERS = [
    { id: 'google', icon: '/googleLogo.png', x: 15, y: 30 },
    { id: 'github', icon: '/gitLogo.png', x: 35, y: 30 },
    { id: 'apple', icon: '/appleLogo.png', x: 55, y: 30 },
    { id: 'linkedIn', icon: '/linkedInLogo.png', x: 75, y: 30 },
]

const ROLE_PROVIDERS = [
    { id: 'student', text: 'Student +', x: 20, y: 30 },
    { id: 'developer', text: 'Tech Developer', x: 40, y: 30 },
    { id: 'founder', text: 'Founder / Entrepreneur', x: 60, y: 30 },
    { id: 'creative', text: 'Creative / FreeLancer', x: 80, y: 30 },
]

const TRACKING_PROVIDERS = [
    { id: 'milestones', text: 'Project Milestones', x: 25, y: 30 }, 
    { id: 'routine', text: 'Daily Routine', x: 50, y: 30 },
    { id: 'high_level', text: 'High-Level Tracking', x: 75, y: 30 },
]

export default function Environment({ currentStage, onStageChange }: EnvironmentProps) {
    const router = useRouter()
    const worldRef = useRef<HTMLDivElement>(null)

    const [playerX, setPlayerX] = useState(5)
    const [playerY, setPlayerY] = useState(0)

    const [isMovingL, setIsMovingL] = useState(false)
    const [isMovingR, setIsMovingR] = useState(false)
    const [isJumping, setIsJumping] = useState(false)
    const [direction, setDirection] = useState<1 | -1>(1)

    // ---> 1. THE NEW POPUP STATE <---
    const [activePopup, setActivePopup] = useState<{ id: string, title: string } | null>(null);

    const playerState = useRef({
        isJumping: false,
        playerXpos: 5
    })

    const moveLeftInterval = useRef<NodeJS.Timeout | null>(null);
    const moveRightInterval = useRef<NodeJS.Timeout | null>(null);

    // ---> 2. UPDATED MASTER TRIGGER <---
    const handleBlockTrigger = (blockId: string, blockText?: string) => {
        console.log(`Player smashed the ${blockId} block!`)

        if (currentStage === 'LOGIN') {
            // Login stays immediate
            setTimeout(() => {
                onStageChange('PREF_1'); 
                setPlayerX(5); 
            }, 1500);
        } else {
            // For Preferences, open the popup instead of changing the level!
            setActivePopup({ id: blockId, title: blockText || 'Preference Selected' });
        }
    }

    // ---> 3. NEW POPUP CONFIRMATION FUNCTION <---
    const handlePopupConfirm = () => {
        setActivePopup(null); // Close the popup

        // Trigger the cinematic fade to the next level
        setTimeout(() => {
            if (currentStage === 'PREF_1') {
                onStageChange('PREF_2');
            } else if (currentStage === 'PREF_2') {
                alert(`Onboarding complete with ${activePopup?.title}!`);
                // router.push('/dashboard');
            }
            setPlayerX(5); // Teleport player back to start
        }, 1500);
    }

    // --- UNIFIED MOVEMENT LOGIC ---
    const startMovingLeft = () => {
        if (moveLeftInterval.current) return; 
        setDirection(-1);
        setIsMovingL(true);
        setIsMovingR(false);
        
        moveLeftInterval.current = setInterval(() => {
            setPlayerX((prevX) => {
                const newX = prevX > 0 ? prevX - 5 : prevX;
                playerState.current.playerXpos = newX;
                return newX;
            });
        }, 150);
        
        setPlayerX((prevX) => {
            const newX = prevX > 0 ? prevX - 5 : prevX;
            playerState.current.playerXpos = newX;
            return newX;
        });
    }

    const stopMovingLeft = () => {
        setIsMovingL(false);
        if (moveLeftInterval.current) {
            clearInterval(moveLeftInterval.current);
            moveLeftInterval.current = null;
        }
    }

    const startMovingRight = () => {
        if (moveRightInterval.current) return;
        setDirection(1);
        setIsMovingR(true);
        setIsMovingL(false);
        
        moveRightInterval.current = setInterval(() => {
            setPlayerX((prevX) => {
                const newX = prevX < 90 ? prevX + 5 : prevX;
                playerState.current.playerXpos = newX;
                return newX;
            });
        }, 150);

        setPlayerX((prevX) => {
            const newX = prevX < 90 ? prevX + 5 : prevX;
            playerState.current.playerXpos = newX;
            return newX;
        });
    }

    const stopMovingRight = () => {
        setIsMovingR(false);
        if (moveRightInterval.current) {
            clearInterval(moveRightInterval.current);
            moveRightInterval.current = null;
        }
    }

    const triggerJump = () => {
        if (!playerState.current.isJumping) {
            playerState.current.isJumping = true;
            setIsJumping(true);
            setPlayerY(-20);

            setTimeout(() => setPlayerY(0), 300);
            setTimeout(() => {
                playerState.current.isJumping = false;
                setIsJumping(false);
            }, 500);
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'A' || e.key === 'a') startMovingLeft();
            if (e.key === 'D' || e.key === 'd') startMovingRight();
            if ((e.key === 'ArrowUp' || e.code === 'Space')) triggerJump();
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'A' || e.key === 'a') stopMovingLeft();
            if (e.key === 'D' || e.key === 'd') stopMovingRight();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            stopMovingLeft();
            stopMovingRight();
        };
    }, []);

    return (
        <>
            {/* 1. THE GAME CANVAS */}
            <div ref={worldRef} id='world' className='relative w-full h-[65%] md:h-full overflow-hidden border-b-4 border-[#2c2c2c] md:border-b-0 shrink-0'>
                <Player xPos={playerX} yPos={playerY} isMovingL={isMovingL} isMovingR={isMovingR} isJumping={isJumping} direction={direction} />

                {currentStage === 'LOGIN' && LOGIN_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} iconSrc={provider.icon} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
                ))}

                {/* NOTE: We now pass provider.text into the handleBlockTrigger! */}
                {currentStage === 'PREF_1' && ROLE_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id, provider.text)} />
                ))}

                {currentStage === 'PREF_2' && TRACKING_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id, provider.text)} />
                ))}


                <div style={{ backgroundImage: "url('/sky.jpg')"}} id="sky" className="w-full h-[70%] bg-sky-500 bg-center bg-cover lg:bg-contain"></div>
                <div style={{ background: "url('/ground.jpg')", backgroundSize: 'cover' }} id="ground" className="w-full h-[30%] bg-green-500"></div>
                
                {/* ========================================================= */}
                {/* ---> 4. THE POPUP OVERLAY (CUSTOMIZE YOUR HTML HERE) <--- */}
                {/* ========================================================= */}
                <AnimatePresence>
                    {activePopup && (
                        <motion.div 
                            className="absolute inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div 
                                // ---> CHANGE YOUR POPUP BACKGROUND, BORDER, AND SHADOW HERE <---
                                className="bg-white border-4 border-[#2c2c2c] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-[8px_8px_0px_#2c2c2c] flex flex-col items-center text-center"
                                initial={{ scale: 0.8, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.8, y: 20 }}
                                transition={{ type: "spring", bounce: 0.5 }}
                            >
                                {/* ---> DYNAMIC TITLE <--- */}
                                <h2 className="text-2xl md:text-3xl font-bold text-[#2c2c2c] mb-2 uppercase">
                                    {activePopup.title}
                                </h2>
                                
                                {/* ---> CUSTOM LORE / TEXT GOES HERE <--- */}
                                {/* You can even use activePopup.id to show different text depending on what they hit! 
                                    Example: {activePopup.id === 'developer' ? 'Unlock API access' : 'Standard setup'} 
                                */}
                                <p className="text-gray-600 mb-8 font-medium">
                                    Are you sure you want to lock in this path? 
                                </p>

                                <div className="flex gap-4 w-full">
                                    {/* ---> CANCEL BUTTON <--- */}
                                    <button 
                                        onClick={() => setActivePopup(null)}
                                        className="flex-1 py-3 border-2 border-gray-400 text-gray-600 font-bold rounded-xl active:translate-y-1 transition-transform"
                                    >
                                        CANCEL
                                    </button>
                                    
                                    {/* ---> CONFIRM BUTTON (Triggers the level change) <--- */}
                                    <button 
                                        onClick={handlePopupConfirm}
                                        className="flex-1 py-3 bg-green-500 border-2 border-[#2c2c2c] text-white font-bold rounded-xl shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        CONFIRM
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* 2. THE MOBILE CONTROLS */}
            <div className="w-full h-[35%] md:hidden flex items-center justify-between px-6 bg-[#fdfbf7]">
                <div className="flex gap-4">
                    <button 
                        className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
                        onPointerDown={startMovingLeft} onPointerUp={stopMovingLeft} onPointerLeave={stopMovingLeft} onContextMenu={(e) => e.preventDefault()} 
                    >
                        <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">←</span>
                    </button>
                    
                    <button 
                        className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
                        onPointerDown={startMovingRight} onPointerUp={stopMovingRight} onPointerLeave={stopMovingRight} onContextMenu={(e) => e.preventDefault()}
                    >
                        <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">→</span>
                    </button>
                </div>

                <button 
                    className="w-20 h-20 bg-white border-[3px] border-[#2c2c2c] rounded-2xl rotate-45 flex items-center justify-center shadow-[6px_6px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none mr-4"
                    onPointerDown={triggerJump} onContextMenu={(e) => e.preventDefault()}
                >
                    <span className="-rotate-45 text-xl font-bold text-[#2c2c2c] block pointer-events-none">JUMP</span>
                </button>
            </div>
        </>
    )
}