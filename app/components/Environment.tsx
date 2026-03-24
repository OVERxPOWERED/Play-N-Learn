// 'use client'
// import { useState, useEffect, useRef } from 'react'
// import { useRouter } from 'next/navigation' // <-- NEW: For redirecting
// import { signIn } from 'next-auth/react' // NextAuth client helper
// import CinematicReveal from './Cinematic-reveal'
// import Player from './Player'
// import Login from '@/app/components/Login'


// const LOGIN_PROVIDERS = [
//     {
//         id: 'google',
//         icon: '/googleLogo.png',
//         x: 15,
//         y: 30
//     },
//     {
//         id: 'github',
//         icon: '/gitLogo.png',
//         x: 35,
//         y: 30
//     },
//     {
//         id: 'apple',
//         icon: '/appleLogo.png',
//         x: 55,
//         y: 30
//     },
//     {
//         id: 'linkedIn',
//         icon: '/linkedInLogo.png',
//         x: 75,
//         y: 30
//     },
// ]


// export default function Environment() {
//     const router = useRouter() // <-- NEW: Initialize the router
//     const worldRef = useRef<HTMLDivElement>(null)

//     const [playerX, setPlayerX] = useState(5)
//     const [playerY, setPlayerY] = useState(0)

//     // New states to pass down to the Player for animation
//     const [isMovingL, setIsMovingL] = useState(false)
//     const [isMovingR, setIsMovingR] = useState(false)

//     const [isJumping, setIsJumping] = useState(false)
//     const [direction, setDirection] = useState<1 | -1>(1) // 1 = right, -1 = left

//     const playerState = useRef({
//         isJumping: false,
//         playerXpos: 0
//     })

//     // 2. The function that handles the routing when a block breaks
//     const handleLoginTrigger = (providerId: string) => {
//         console.log(`Player smashed the ${providerId} block! Initiating NextAuth...`)
//         signIn(providerId, { callbackUrl: '/dashboard' })
//     }

//     useEffect(() => {
//         const handleKeyDown = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a') {
//                 setDirection(-1);
//                 setIsMovingL(true);
//                 setIsMovingR(false);
//                 setPlayerX((prevX) => {
//                     const newX = prevX > 0 ? prevX - 5 : prevX;
//                     playerState.current.playerXpos = newX;
//                     return newX;
//                 });
//             }
//             if (e.key === 'D' || e.key === 'd') {
//                 setDirection(1);
//                 setIsMovingR(true);
//                 setIsMovingL(false);
//                 setPlayerX((prevX) => {
//                     const newX = prevX < 90 ? prevX + 5 : prevX;
//                     playerState.current.playerXpos = newX;
//                     return newX;
//                 });
//             }

//             if ((e.key === 'ArrowUp' || e.code === 'Space') && !(playerState.current.isJumping)) {
//                 playerState.current.isJumping = true;
//                 setIsJumping(true);
//                 setPlayerY(-20);

//                 setTimeout(() => {
//                     setPlayerY(0);
//                 }, 300);

//                 setTimeout(() => {
//                     playerState.current.isJumping = false;
//                     setIsJumping(false);
//                 }, 500);
//             }
//         };

//         const handleKeyUp = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a' || e.key === 'D' || e.key === 'd') {
//                 setIsMovingL(false);
//                 setIsMovingR(false);
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         document.addEventListener('keyup', handleKeyUp);

//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//             document.removeEventListener('keyup', handleKeyUp);
//         };
//     }, []);

//     return (
//         <div ref={worldRef} id='world' className='flex flex-col h-full w-full overflow-hidden relative'>
//             {/* <CinematicReveal /> */}

//             <Player
//                 xPos={playerX}
//                 yPos={playerY}
//                 isMovingL={isMovingL}
//                 isMovingR={isMovingR}
//                 isJumping={isJumping}
//                 direction={direction}
//             />

//             {/* 3. Render the Login Blocks dynamically */}
//             {LOGIN_PROVIDERS.map((provider) => (
//                 <Login
//                     key={provider.id}
//                     x={provider.x}
//                     y={provider.y}
//                     iconSrc={provider.icon} // Pass the icon down
//                     playerState={playerState}
//                     onBreak={() => handleLoginTrigger(provider.id)} // Pass the trigger down
//                 />
//                 // <LoginPage />
//             ))}

//             <div
//                 style={{
//                     backgroundImage: "url('/sky.jpg')",
//                     backgroundSize: 'contain',
//                 }}
//                 id="sky"
//                 className="w-full h-[70%] bg-sky-500 bg-center "
//             ></div>
//             <div
//                 style={{
//                     background: "url('/ground.jpg')",
//                     backgroundSize: 'cover',
//                 }}
//                 id="ground" className="w-full h-[30%] bg-green-500"></div>
//         </div>
//     )
// }


// 'use client'
// import { useState, useEffect, useRef } from 'react'
// import { useRouter } from 'next/navigation'
// import { signIn } from 'next-auth/react'
// import Player from './Player'
// import Login from './Login' // Adjusted path to match standard NextJS imports
// import CinematicReveal from './Cinematic-reveal' // Optional cinematic component for intro sequence

// const LOGIN_PROVIDERS = [
//     { id: 'google', icon: '/googleLogo.png', x: 15, y: 30 },
//     { id: 'github', icon: '/gitLogo.png', x: 35, y: 30 },
//     { id: 'apple', icon: '/appleLogo.png', x: 55, y: 30 },
//     { id: 'linkedIn', icon: '/linkedInLogo.png', x: 75, y: 30 },
// ]

// export default function Environment() {
//     const router = useRouter()
//     const worldRef = useRef<HTMLDivElement>(null)

//     const [playerX, setPlayerX] = useState(5)
//     const [playerY, setPlayerY] = useState(0)

//     const [isMovingL, setIsMovingL] = useState(false)
//     const [isMovingR, setIsMovingR] = useState(false)
//     const [isJumping, setIsJumping] = useState(false)
//     const [direction, setDirection] = useState<1 | -1>(1)

//     const playerState = useRef({
//         isJumping: false,
//         playerXpos: 5
//     })

//     // Refs to hold the intervals for continuous touch movement
//     const moveLeftInterval = useRef<NodeJS.Timeout | null>(null);
//     const moveRightInterval = useRef<NodeJS.Timeout | null>(null);

//     const handleLoginTrigger = (providerId: string) => {
//         console.log(`Player smashed the ${providerId} block! Initiating NextAuth...`)
//         signIn(providerId, { callbackUrl: '/dashboard' })
//     }

//     // --- UNIFIED MOVEMENT LOGIC ---
    
//     const startMovingLeft = () => {
//         if (moveLeftInterval.current) return; // Prevent multiple intervals
//         setDirection(-1);
//         setIsMovingL(true);
//         setIsMovingR(false);
        
//         // Interval matches your original GSAP duration (0.15s = 150ms) for smooth continuous movement
//         moveLeftInterval.current = setInterval(() => {
//             setPlayerX((prevX) => {
//                 const newX = prevX > 0 ? prevX - 5 : prevX;
//                 playerState.current.playerXpos = newX;
//                 return newX;
//             });
//         }, 150);
        
//         // Trigger initial step immediately
//         setPlayerX((prevX) => {
//             const newX = prevX > 0 ? prevX - 5 : prevX;
//             playerState.current.playerXpos = newX;
//             return newX;
//         });
//     }

//     const stopMovingLeft = () => {
//         setIsMovingL(false);
//         if (moveLeftInterval.current) {
//             clearInterval(moveLeftInterval.current);
//             moveLeftInterval.current = null;
//         }
//     }

//     const startMovingRight = () => {
//         if (moveRightInterval.current) return;
//         setDirection(1);
//         setIsMovingR(true);
//         setIsMovingL(false);
        
//         moveRightInterval.current = setInterval(() => {
//             setPlayerX((prevX) => {
//                 const newX = prevX < 90 ? prevX + 5 : prevX;
//                 playerState.current.playerXpos = newX;
//                 return newX;
//             });
//         }, 150);

//         setPlayerX((prevX) => {
//             const newX = prevX < 90 ? prevX + 5 : prevX;
//             playerState.current.playerXpos = newX;
//             return newX;
//         });
//     }

//     const stopMovingRight = () => {
//         setIsMovingR(false);
//         if (moveRightInterval.current) {
//             clearInterval(moveRightInterval.current);
//             moveRightInterval.current = null;
//         }
//     }

//     const triggerJump = () => {
//         if (!playerState.current.isJumping) {
//             playerState.current.isJumping = true;
//             setIsJumping(true);
//             setPlayerY(-20);

//             setTimeout(() => setPlayerY(0), 300);
//             setTimeout(() => {
//                 playerState.current.isJumping = false;
//                 setIsJumping(false);
//             }, 500);
//         }
//     }

//     // --- KEYBOARD EVENT LISTENERS ---
//     useEffect(() => {
//         const handleKeyDown = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a') startMovingLeft();
//             if (e.key === 'D' || e.key === 'd') startMovingRight();
//             if ((e.key === 'ArrowUp' || e.code === 'Space')) triggerJump();
//         };

//         const handleKeyUp = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a') stopMovingLeft();
//             if (e.key === 'D' || e.key === 'd') stopMovingRight();
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         document.addEventListener('keyup', handleKeyUp);

//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//             document.removeEventListener('keyup', handleKeyUp);
//             stopMovingLeft();
//             stopMovingRight();
//         };
//     }, []);

//   return (
//         <>
//         <CinematicReveal heading='' /> {/* Optional cinematic intro sequence */}
//             {/* 1. THE GAME CANVAS: Now takes up 65% of mobile screen */}
//             <div ref={worldRef} id='world' className='relative w-full h-[65%] md:h-full overflow-hidden border-b-4 border-[#2c2c2c] md:border-b-0 shrink-0'>
//                 <Player xPos={playerX} yPos={playerY} isMovingL={isMovingL} isMovingR={isMovingR} isJumping={isJumping} direction={direction} />

//                 {LOGIN_PROVIDERS.map((provider) => (
//                     <Login key={provider.id} x={provider.x} y={provider.y} iconSrc={provider.icon} playerState={playerState} onBreak={() => handleLoginTrigger(provider.id)} />
//                 ))}

//                 {/* Reverted backgroundSize to 'contain' so the text is visible again */}
//                 <div style={{ backgroundImage: "url('/sky.jpg')"}} id="sky" className="w-full h-[70%] bg-sky-500 bg-center bg-cover lg:bg-contain"></div>
//                 <div style={{ background: "url('/ground.jpg')", backgroundSize: 'cover' }} id="ground" className="w-full h-[30%] bg-green-500"></div>
//             </div>

//             {/* 2. THE MOBILE CONTROLS: Now takes up the remaining 35% */}
//             <div className="w-full h-[35%] md:hidden flex items-center justify-between px-6 bg-[#fdfbf7]">
                
//                 {/* D-Pad Buttons */}
//                 <div className="flex gap-4">
//                     <button 
//                         className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
//                         onPointerDown={startMovingLeft}
//                         onPointerUp={stopMovingLeft}
//                         onPointerLeave={stopMovingLeft}
//                         onContextMenu={(e) => e.preventDefault()} 
//                     >
//                         <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">←</span>
//                     </button>
                    
//                     <button 
//                         className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
//                         onPointerDown={startMovingRight}
//                         onPointerUp={stopMovingRight}
//                         onPointerLeave={stopMovingRight}
//                         onContextMenu={(e) => e.preventDefault()}
//                     >
//                         <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">→</span>
//                     </button>
//                 </div>

//                 {/* Jump Button */}
//                 <button 
//                     className="w-20 h-20 bg-white border-[3px] border-[#2c2c2c] rounded-2xl rotate-45 flex items-center justify-center shadow-[6px_6px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none mr-4"
//                     onPointerDown={triggerJump}
//                     onContextMenu={(e) => e.preventDefault()}
//                 >
//                     <span className="-rotate-45 text-xl font-bold text-[#2c2c2c] block pointer-events-none">JUMP</span>
//                 </button>

//             </div>
//         </>
//     )
// }












// All WOrkinf
// 'use client'
// import { useState, useEffect, useRef } from 'react'
// import { useRouter } from 'next/navigation'
// import { signIn } from 'next-auth/react'
// import Player from './Player'
// import Login from './Login' // Your block component

// // 1. We define the props so Environment can talk to Phone.tsx
// interface EnvironmentProps {
//     currentStage: string;
//     onStageChange: (newStage: string) => void;
// }

// // 2. The Level Configurations
// const LOGIN_PROVIDERS = [
//     { id: 'google', icon: '/googleLogo.png', x: 15, y: 30 },
//     { id: 'github', icon: '/gitLogo.png', x: 35, y: 30 },
//     { id: 'apple', icon: '/appleLogo.png', x: 55, y: 30 },
//     { id: 'linkedIn', icon: '/linkedInLogo.png', x: 75, y: 30 },
// ]

// const ROLE_PROVIDERS = [
//     { id: 'student', text: 'Student +', x: 20, y: 40 },
//     { id: 'developer', text: 'Tech Developer', x: 40, y: 40 },
//     { id: 'founder', text: 'Founder / Entrepreneur', x: 60, y: 40 },
//     { id: 'creative', text: 'Creative / FreeLancer', x: 80, y: 40 },
// ]

// const TRACKING_PROVIDERS = [
//     { id: 'milestones', text: 'Project Milestones', x: 25, y: 50 },
//     { id: 'routine', text: 'Daily Routine', x: 50, y: 50 },
//     { id: 'high_level', text: 'High-Level Tracking', x: 75, y: 50 },
// ]

// // 3. Receive the props here
// export default function Environment({ currentStage, onStageChange }: EnvironmentProps) {
//     const router = useRouter()
//     const worldRef = useRef<HTMLDivElement>(null)

//     const [playerX, setPlayerX] = useState(5)
//     const [playerY, setPlayerY] = useState(0)

//     const [isMovingL, setIsMovingL] = useState(false)
//     const [isMovingR, setIsMovingR] = useState(false)
//     const [isJumping, setIsJumping] = useState(false)
//     const [direction, setDirection] = useState<1 | -1>(1)

//     const playerState = useRef({
//         isJumping: false,
//         playerXpos: 5
//     })

//     const moveLeftInterval = useRef<NodeJS.Timeout | null>(null);
//     const moveRightInterval = useRef<NodeJS.Timeout | null>(null);

//     // 4. THE MASTER TRIGGER FUNCTION
//     const handleBlockTrigger = (blockId: string) => {
//         console.log(`Player smashed the ${blockId} block!`)

//         if (currentStage === 'LOGIN') {
//             // Execute NextAuth login... 
//             // signIn(blockId, { callbackUrl: '/dashboard' }) 
            
//             // Wait 1.5s for the Cinematic Reveal screen to go completely black
//             setTimeout(() => {
//                 onStageChange('PREF_1'); // Tells Phone.tsx to change the stage
//                 setPlayerX(5); // Teleport player back to start
//             }, 1500);

//         } else if (currentStage === 'PREF_1') {
//             // Handle Role Selection (Save to DB, etc.)
//             setTimeout(() => {
//                 onStageChange('PREF_2'); 
//                 setPlayerX(5); 
//             }, 1500);

//         } else if (currentStage === 'PREF_2') {
//             // Final completion
//             setTimeout(() => {
//                 alert(`Onboarding complete with ${blockId}! Redirecting...`);
//                 // router.push('/dashboard');
//             }, 1500);
//         }
//     }

//     // --- UNIFIED MOVEMENT LOGIC ---
    
//     const startMovingLeft = () => {
//         if (moveLeftInterval.current) return; 
//         setDirection(-1);
//         setIsMovingL(true);
//         setIsMovingR(false);
        
//         moveLeftInterval.current = setInterval(() => {
//             setPlayerX((prevX) => {
//                 const newX = prevX > 0 ? prevX - 5 : prevX;
//                 playerState.current.playerXpos = newX;
//                 return newX;
//             });
//         }, 150);
        
//         setPlayerX((prevX) => {
//             const newX = prevX > 0 ? prevX - 5 : prevX;
//             playerState.current.playerXpos = newX;
//             return newX;
//         });
//     }

//     const stopMovingLeft = () => {
//         setIsMovingL(false);
//         if (moveLeftInterval.current) {
//             clearInterval(moveLeftInterval.current);
//             moveLeftInterval.current = null;
//         }
//     }

//     const startMovingRight = () => {
//         if (moveRightInterval.current) return;
//         setDirection(1);
//         setIsMovingR(true);
//         setIsMovingL(false);
        
//         moveRightInterval.current = setInterval(() => {
//             setPlayerX((prevX) => {
//                 const newX = prevX < 90 ? prevX + 5 : prevX;
//                 playerState.current.playerXpos = newX;
//                 return newX;
//             });
//         }, 150);

//         setPlayerX((prevX) => {
//             const newX = prevX < 90 ? prevX + 5 : prevX;
//             playerState.current.playerXpos = newX;
//             return newX;
//         });
//     }

//     const stopMovingRight = () => {
//         setIsMovingR(false);
//         if (moveRightInterval.current) {
//             clearInterval(moveRightInterval.current);
//             moveRightInterval.current = null;
//         }
//     }

//     const triggerJump = () => {
//         if (!playerState.current.isJumping) {
//             playerState.current.isJumping = true;
//             setIsJumping(true);
//             setPlayerY(-20);

//             setTimeout(() => setPlayerY(0), 300);
//             setTimeout(() => {
//                 playerState.current.isJumping = false;
//                 setIsJumping(false);
//             }, 500);
//         }
//     }

//     // --- KEYBOARD EVENT LISTENERS ---
//     useEffect(() => {
//         const handleKeyDown = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a') startMovingLeft();
//             if (e.key === 'D' || e.key === 'd') startMovingRight();
//             if ((e.key === 'ArrowUp' || e.code === 'Space')) triggerJump();
//         };

//         const handleKeyUp = (e: KeyboardEvent) => {
//             if (e.key === 'A' || e.key === 'a') stopMovingLeft();
//             if (e.key === 'D' || e.key === 'd') stopMovingRight();
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         document.addEventListener('keyup', handleKeyUp);

//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//             document.removeEventListener('keyup', handleKeyUp);
//             stopMovingLeft();
//             stopMovingRight();
//         };
//     }, []);

//     return (
//         <>
//             {/* 1. THE GAME CANVAS */}
//             {/* 1. THE GAME CANVAS */}
//             <div ref={worldRef} id='world' className='relative w-full h-[65%] md:h-full overflow-hidden border-b-4 border-[#2c2c2c] md:border-b-0 shrink-0'>
//                 <Player xPos={playerX} yPos={playerY} isMovingL={isMovingL} isMovingR={isMovingR} isJumping={isJumping} direction={direction} />

//                 {/* 5. CONDITIONAL RENDERING OF BLOCKS BASED ON STAGE */}
                
//                 {currentStage === 'LOGIN' && LOGIN_PROVIDERS.map((provider) => (
//                     <Login key={provider.id} x={provider.x} y={provider.y} iconSrc={provider.icon} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
//                 ))}

//                 {currentStage === 'PREF_1' && ROLE_PROVIDERS.map((provider) => (
//                     <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
//                 ))}

//                 {currentStage === 'PREF_2' && TRACKING_PROVIDERS.map((provider) => (
//                     <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
//                 ))}

//                 {/* ---> [STAGE MARKER 3: Add {currentStage === 'PREF_3' && ...} here] <--- */}

//                 <div style={{ backgroundImage: "url('/sky.jpg')"}} id="sky" className="w-full h-[70%] bg-sky-500 bg-center bg-cover lg:bg-contain"></div>
//                 <div style={{ background: "url('/ground.jpg')", backgroundSize: 'cover' }} id="ground" className="w-full h-[30%] bg-green-500"></div>
//             </div>
//             {/* 2. THE MOBILE CONTROLS */}
//             <div className="w-full h-[35%] md:hidden flex items-center justify-between px-6 bg-[#fdfbf7]">
                
//                 {/* D-Pad Buttons */}
//                 <div className="flex gap-4">
//                     <button 
//                         className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
//                         onPointerDown={startMovingLeft}
//                         onPointerUp={stopMovingLeft}
//                         onPointerLeave={stopMovingLeft}
//                         onContextMenu={(e) => e.preventDefault()} 
//                     >
//                         <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">←</span>
//                     </button>
                    
//                     <button 
//                         className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
//                         onPointerDown={startMovingRight}
//                         onPointerUp={stopMovingRight}
//                         onPointerLeave={stopMovingRight}
//                         onContextMenu={(e) => e.preventDefault()}
//                     >
//                         <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">→</span>
//                     </button>
//                 </div>

//                 {/* Jump Button */}
//                 <button 
//                     className="w-20 h-20 bg-white border-[3px] border-[#2c2c2c] rounded-2xl rotate-45 flex items-center justify-center shadow-[6px_6px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none mr-4"
//                     onPointerDown={triggerJump}
//                     onContextMenu={(e) => e.preventDefault()}
//                 >
//                     <span className="-rotate-45 text-xl font-bold text-[#2c2c2c] block pointer-events-none">JUMP</span>
//                 </button>

//             </div>
//         </>
//     )
// }






'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Player from './Player'
import Login from './Login' // Your block component

// 1. We define the props so Environment can talk to Phone.tsx
interface EnvironmentProps {
    currentStage: string;
    onStageChange: (newStage: string) => void;
}

// 2. The Level Configurations
const LOGIN_PROVIDERS = [
    { id: 'google', icon: '/googleLogo.png', x: 15, y: 30 },
    { id: 'github', icon: '/gitLogo.png', x: 35, y: 30 },
    { id: 'apple', icon: '/appleLogo.png', x: 55, y: 30 },
    { id: 'linkedIn', icon: '/linkedInLogo.png', x: 75, y: 30 },
]

const ROLE_PROVIDERS = [
    { id: 'student', text: 'Student +', x: 20, y: 40 },
    { id: 'developer', text: 'Tech Developer', x: 40, y: 40 },
    { id: 'founder', text: 'Founder / Entrepreneur', x: 60, y: 40 },
    { id: 'creative', text: 'Creative / FreeLancer', x: 80, y: 40 },
]

const TRACKING_PROVIDERS = [
    { id: 'milestones', text: 'Project Milestones', x: 25, y: 50 },
    { id: 'routine', text: 'Daily Routine', x: 50, y: 50 },
    { id: 'high_level', text: 'High-Level Tracking', x: 75, y: 50 },
]

// 3. Receive the props here
export default function Environment({ currentStage, onStageChange }: EnvironmentProps) {
    const router = useRouter()
    const worldRef = useRef<HTMLDivElement>(null)

    const [playerX, setPlayerX] = useState(5)
    const [playerY, setPlayerY] = useState(0)

    const [isMovingL, setIsMovingL] = useState(false)
    const [isMovingR, setIsMovingR] = useState(false)
    const [isJumping, setIsJumping] = useState(false)
    const [direction, setDirection] = useState<1 | -1>(1)

    const playerState = useRef({
        isJumping: false,
        playerXpos: 5
    })

    const moveLeftInterval = useRef<NodeJS.Timeout | null>(null);
    const moveRightInterval = useRef<NodeJS.Timeout | null>(null);

    // 4. THE MASTER TRIGGER FUNCTION
    const handleBlockTrigger = (blockId: string) => {
        console.log(`Player smashed the ${blockId} block!`)

        if (currentStage === 'LOGIN') {
            // Execute NextAuth login... 
            // signIn(blockId, { callbackUrl: '/dashboard' }) 
            
            // Wait 1.5s for the Cinematic Reveal screen to go completely black
            setTimeout(() => {
                onStageChange('PREF_1'); // Tells Phone.tsx to change the stage
                setPlayerX(5); // Teleport player back to start
            }, 1500);

        } else if (currentStage === 'PREF_1') {
            // Handle Role Selection (Save to DB, etc.)
            setTimeout(() => {
                onStageChange('PREF_2'); 
                setPlayerX(5); 
            }, 1500);

        } else if (currentStage === 'PREF_2') {
            // Final completion
            setTimeout(() => {
                alert(`Onboarding complete with ${blockId}! Redirecting...`);
                // router.push('/dashboard');
            }, 1500);
        }
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

    // --- KEYBOARD EVENT LISTENERS ---
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

                {/* 5. CONDITIONAL RENDERING OF BLOCKS BASED ON STAGE */}
                
                {currentStage === 'LOGIN' && LOGIN_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} iconSrc={provider.icon} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
                ))}

                {currentStage === 'PREF_1' && ROLE_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
                ))}

                {currentStage === 'PREF_2' && TRACKING_PROVIDERS.map((provider) => (
                    <Login key={provider.id} x={provider.x} y={provider.y} text={provider.text} playerState={playerState} onBreak={() => handleBlockTrigger(provider.id)} />
                ))}

                <div style={{ backgroundImage: "url('/sky.jpg')"}} id="sky" className="w-full h-[70%] bg-sky-500 bg-center bg-cover lg:bg-contain"></div>
                <div style={{ background: "url('/ground.jpg')", backgroundSize: 'cover' }} id="ground" className="w-full h-[30%] bg-green-500"></div>
            </div>

            {/* 2. THE MOBILE CONTROLS */}
            <div className="w-full h-[35%] md:hidden flex items-center justify-between px-6 bg-[#fdfbf7]">
                
                {/* D-Pad Buttons */}
                <div className="flex gap-4">
                    <button 
                        className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
                        onPointerDown={startMovingLeft}
                        onPointerUp={stopMovingLeft}
                        onPointerLeave={stopMovingLeft}
                        onContextMenu={(e) => e.preventDefault()} 
                    >
                        <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">←</span>
                    </button>
                    
                    <button 
                        className="w-16 h-16 bg-white border-[3px] border-[#2c2c2c] rounded-xl rotate-45 flex items-center justify-center shadow-[4px_4px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none"
                        onPointerDown={startMovingRight}
                        onPointerUp={stopMovingRight}
                        onPointerLeave={stopMovingRight}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <span className="-rotate-45 text-3xl font-bold text-[#2c2c2c] block pointer-events-none pb-1">→</span>
                    </button>
                </div>

                {/* Jump Button */}
                <button 
                    className="w-20 h-20 bg-white border-[3px] border-[#2c2c2c] rounded-2xl rotate-45 flex items-center justify-center shadow-[6px_6px_0px_#2c2c2c] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all touch-manipulation select-none mr-4"
                    onPointerDown={triggerJump}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <span className="-rotate-45 text-xl font-bold text-[#2c2c2c] block pointer-events-none">JUMP</span>
                </button>

            </div>
        </>
    )
}