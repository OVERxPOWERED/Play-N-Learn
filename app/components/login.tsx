// // app/login/page.tsx
// 'use client'

// import React, { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import { motion, AnimatePresence } from 'motion/react'
// import { usePlayer } from '@/hooks/usePlayer' 
// import Player from '@/app/components/Player'
// import Block from '@/app/components/Block'

// // ============================================================================
// // LEVEL 1 DATA: THE LOGIN PROVIDERS
// // ============================================================================
// type Provider = {
//     id: string;
//     name: string;
//     icon: string;
//     color: string;
//     x: number;
//     y: number;
//     type: 'oauth' | 'form';
// }

// const LOGIN_PROVIDERS: Provider[] = [
//     { 
//         id: 'google', 
//         name: 'Google', 
//         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg', 
//         color: '#DB4437',
//         x: 20, 
//         y: 50,
//         type: 'oauth'
//     },
//     { 
//         id: 'github', 
//         name: 'GitHub', 
//         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg', 
//         color: '#333333',
//         x: 40, 
//         y: 35,
//         type: 'oauth'
//     },
//     { 
//         id: 'discord', 
//         name: 'Discord', 
//         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/discord/discord-original.svg', 
//         color: '#5865F2',
//         x: 60, 
//         y: 50,
//         type: 'oauth'
//     },
//     { 
//         id: 'email', 
//         name: 'Email', 
//         icon: 'https://cdn-icons-png.flaticon.com/512/732/732200.png', 
//         color: '#10B981',
//         x: 80, 
//         y: 35,
//         type: 'form'
//     },
// ]

// // ============================================================================
// // SCENERY COMPONENTS (Adds depth to the level)
// // ============================================================================
// const Cloud = ({ delay, top, duration, scale = 1 }: { delay: number, top: string, duration: number, scale?: number }) => (
//     <motion.div
//         className="absolute opacity-90 z-0 pointer-events-none"
//         style={{ top, transform: `scale(${scale})` }}
//         initial={{ x: '-20vw' }}
//         animate={{ x: '120vw' }}
//         transition={{ duration, repeat: Infinity, ease: "linear", delay }}
//     >
//         <div className="relative w-32 h-10 bg-white rounded-full blur-[1px]">
//             <div className="absolute w-16 h-16 bg-white rounded-full -top-8 left-4"></div>
//             <div className="absolute w-20 h-20 bg-white rounded-full -top-10 left-10"></div>
//         </div>
//     </motion.div>
// )

// const Mountain = ({ right, height, color }: { right: string, height: string, color: string }) => (
//     <div 
//         className="absolute bottom-[30%] z-0 pointer-events-none rounded-t-full"
//         style={{ 
//             right, 
//             height, 
//             width: height, 
//             backgroundColor: color,
//             transform: 'translateY(5px)' // Tuck it slightly behind the ground
//         }}
//     />
// )

// // ============================================================================
// // MAIN LEVEL COMPONENT
// // ============================================================================
// export default function LoginPage() {
//     const router = useRouter()
//     const physics = usePlayer() 
    
//     const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null)
//     const [isLevelActive, setIsLevelActive] = useState(true)

//     // Triggered by the updated Block.tsx's onBreak prop
//     const handleLoginBreak = (provider: Provider) => {
//         setIsLevelActive(false) // Freeze the player
//         setConnectingProvider(provider) // Mount the popup
        
//         // If it's an OAuth provider, simulate a connection delay then route
//         if (provider.type === 'oauth') {
//             setTimeout(() => {
//                 console.log(`Initiating NextAuth for ${provider.name}...`)
//                 // signIn(provider.id)
//             }, 2500) 
//         }
//     }

//     // Allow user to close the email form and resume the game
//     const closeForm = () => {
//         setConnectingProvider(null)
//         // Add a tiny delay before giving control back so they don't jump immediately
//         setTimeout(() => setIsLevelActive(true), 300)
//     }

//     return (
//         <div className='flex flex-col h-screen w-screen overflow-hidden relative bg-[#87CEEB] selection:bg-transparent'>
            
//             {/* --- BACKGROUND SCENERY --- */}
//             <Cloud delay={0} top="10%" duration={45} scale={1.2} />
//             <Cloud delay={15} top="25%" duration={35} scale={0.8} />
//             <Cloud delay={5} top="15%" duration={60} scale={1} />
            
//             <Mountain right="-10%" height="40vh" color="#4FA4A5" />
//             <Mountain right="15%" height="25vh" color="#66C2C3" />
//             <Mountain right="60%" height="35vh" color="#3B8E8F" />

//             {/* --- THE PLAYER --- */}
//             {/* We blur the background layer (Player + Blocks) when the popup is active */}
//             <motion.div 
//                 className="absolute inset-0 w-full h-full"
//                 animate={{ 
//                     filter: connectingProvider ? "blur(8px)" : "blur(0px)",
//                     opacity: connectingProvider ? 0.6 : 1
//                 }}
//                 transition={{ duration: 0.4 }}
//             >
//                 <Player {...physics} />

//                 {/* --- THE INTERACTIVE BLOCKS --- */}
//                 {LOGIN_PROVIDERS.map((p) => (
//                     <div key={p.id} className={isLevelActive ? '' : 'pointer-events-none'}>
//                         <Block 
//                             x={p.x} 
//                             y={p.y} 
//                             iconSrc={p.icon} 
//                             playerState={physics.playerState} 
//                             onBreak={() => handleLoginBreak(p)} 
//                         />
//                     </div>
//                 ))}
//             </motion.div>

//             {/* --- THE GROUND --- */}
//             <div 
//                 id="ground" 
//                 className="absolute bottom-0 w-full h-[30%] bg-[#5CB85C] border-t-[12px] border-[#3E8E41] z-0 flex flex-col items-center pt-8"
//             >
//                 {/* Grass detail line */}
//                 <div className="absolute top-2 w-full h-2 bg-[#4CAF50] opacity-50"></div>
                
//                 <motion.div 
//                     initial={{ y: 20, opacity: 0 }}
//                     animate={{ y: 0, opacity: 1 }}
//                     transition={{ delay: 0.5, duration: 0.8 }}
//                     className="text-center z-10"
//                 >
//                     <h1 className="text-white text-4xl md:text-6xl font-black uppercase tracking-widest opacity-90 drop-shadow-md">
//                         Login Level
//                     </h1>
//                     <p className="text-[#E0F8E0] font-bold mt-2 uppercase tracking-widest text-lg drop-shadow">
//                         Smash a block to continue
//                     </p>
//                 </motion.div>
//             </div>

//             {/* ===============================================================
//                 THE "GENTLE OPEN" MODAL OVERLAY 
//                 =============================================================== */}
//             <AnimatePresence>
//                 {connectingProvider && (
//                     <motion.div 
//                         className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         exit={{ opacity: 0 }}
//                         transition={{ duration: 0.3 }}
//                     >
//                         <motion.div 
//                             // The modal expands gently from the bottom with a spring
//                             initial={{ scale: 0.8, y: 100, opacity: 0 }}
//                             animate={{ scale: 1, y: 0, opacity: 1 }}
//                             exit={{ scale: 0.9, y: 50, opacity: 0 }}
//                             transition={{ type: "spring", bounce: 0.3, duration: 0.7 }}
//                             className="relative bg-white p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6 text-black border-b-8 w-[90%] max-w-md overflow-hidden"
//                             style={{ borderColor: connectingProvider.color }}
//                         >
                            
//                             {/* Animated Background Glow inside the card */}
//                             <motion.div 
//                                 className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
//                                 style={{ backgroundColor: connectingProvider.color }}
//                                 animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
//                                 transition={{ repeat: Infinity, duration: 3 }}
//                             />

//                             {/* OAUTH CONNECTING VIEW */}
//                             {connectingProvider.type === 'oauth' && (
//                                 <>
//                                     <div className="relative w-28 h-28 p-4 bg-gray-50 rounded-2xl shadow-inner flex items-center justify-center border border-gray-100 z-10">
//                                         <motion.img 
//                                             src={connectingProvider.icon} 
//                                             alt={connectingProvider.name} 
//                                             className="w-full h-full object-contain"
//                                             initial={{ scale: 0 }}
//                                             animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
//                                             transition={{ type: "spring", delay: 0.2 }}
//                                         />
//                                     </div>
//                                     <div className="text-center z-10 mt-4">
//                                         <h2 className="text-3xl font-black text-gray-800">
//                                             Authenticating
//                                         </h2>
//                                         <p className="text-gray-500 font-medium mt-2 flex items-center justify-center gap-2">
//                                             Opening {connectingProvider.name} portal
//                                             <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>.</motion.span>
//                                             <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>.</motion.span>
//                                             <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>.</motion.span>
//                                         </p>
//                                     </div>
//                                 </>
//                             )}

//                             {/* STANDARD EMAIL FORM VIEW */}
//                             {connectingProvider.type === 'form' && (
//                                 <div className="w-full z-10 flex flex-col">
//                                     <div className="flex items-center gap-4 mb-6">
//                                         <img src={connectingProvider.icon} alt="Email" className="w-10 h-10 object-contain" />
//                                         <h2 className="text-3xl font-black text-gray-800">Welcome Back</h2>
//                                     </div>
                                    
//                                     <div className="space-y-4 w-full">
//                                         <div>
//                                             <label className="block text-sm font-bold text-gray-600 mb-1">Email Address</label>
//                                             <input 
//                                                 type="email" 
//                                                 placeholder="mario@mushroomkingdom.com"
//                                                 className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
//                                                 style={{ focusRingColor: connectingProvider.color }}
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-bold text-gray-600 mb-1">Password</label>
//                                             <input 
//                                                 type="password" 
//                                                 placeholder="••••••••"
//                                                 className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
//                                             />
//                                         </div>
//                                         <button 
//                                             className="w-full py-3 mt-4 text-white font-black text-lg rounded-xl shadow-lg hover:brightness-110 transition-all active:scale-95"
//                                             style={{ backgroundColor: connectingProvider.color }}
//                                             onClick={() => console.log('Log in clicked')}
//                                         >
//                                             ENTER WORLD
//                                         </button>
//                                     </div>
                                    
//                                     {/* Close Button to return to the game */}
//                                     <button 
//                                         onClick={closeForm}
//                                         className="mt-6 text-sm text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest transition-colors"
//                                     >
//                                         Cancel & Return
//                                     </button>
//                                 </div>
//                             )}

//                         </motion.div>
//                     </motion.div>
//                 )}
//             </AnimatePresence>
//         </div>
//     )
// }