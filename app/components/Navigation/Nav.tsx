// "use client"
// import React, { useState } from 'react'
// import { motion, AnimatePresence } from "motion/react"

// // Define explicit sizes for clean layout transitions
// const COLLAPSED_HEIGHT = 64;

// export default function Nav({ 
//   name = "Pranav Dubey", 
//   role = "Player",
//   className = "Assassin",
//   region = "IND",
//   status = "Active",
//   guild = "None",
//   currentXp = 8500, 
//   maxXp = 10000,    
//   profilePicUrl = "" 
// }: {
//   name?: string;
//   role?: string;
//   className?: string;
//   region?: string;
//   status?: string;
//   guild?: string;
//   currentXp?: number;
//   maxXp?: number;
//   profilePicUrl?: string;
// }) {
//   const [isHovered, setIsHovered] = useState(false);

//   // Calculate the width percentage for the XP bar
//   const xpPercentage = Math.min((currentXp / maxXp) * 100, 100);

//   return (
//     <motion.div 
//       style={{ fontFamily: '"Roboto Mono", monospace' }}
//       // Main Container: Deep Solo Leveling Dark Theme
//       className='absolute top-6 right-6 rounded-3xl bg-[#090f26]/95 backdrop-blur-xl border border-[#1e293b] shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden z-50 flex flex-col cursor-default'
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={() => setIsHovered(false)}
//       initial={{ width: 240, height: COLLAPSED_HEIGHT }} // Slightly wider to fit Name + Circle
//       animate={{ 
//         width: isHovered ? 400 : 240, 
//         height: isHovered ? "auto" : COLLAPSED_HEIGHT 
//       }}
//       transition={{ type: "spring", stiffness: 300, damping: 25 }}
//       layout 
//     >
      
//       {/* --- COLLAPSED STATE (Name + Small Avatar) --- */}
//       <AnimatePresence>
//         {!isHovered && (
//           <motion.div
//             key="collapsed"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             transition={{ duration: 0.2 }}
//             className="absolute inset-0 flex items-center justify-between p-5"
//           >
//             <span className="text-lg font-bold text-gray-100 tracking-wide truncate">
//               {name}
//             </span>
//             {/* The small avatar that morphs into the big one */}
//             <motion.div 
//               layoutId="profile-avatar"
//               className="w-11 h-11 rounded-full border border-[#6366f1] bg-[#0e1c41] flex-shrink-0 flex items-center justify-center overflow-hidden"
//             >
//               {profilePicUrl ? (
//                  <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
//               ) : (
//                  <span className="text-[#818cf8] font-bold text-lg">{name.charAt(0)}</span>
//               )}
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* --- HOVERED STATE (Expanded Status Page) --- */}
//       <AnimatePresence>
//         {isHovered && (
//           <motion.div
//             key="hovered"
//             initial={{ opacity: 0, height: 0 }}
//             animate={{ opacity: 1, height: "auto" }}
//             exit={{ opacity: 0, height: 0 }}
//             transition={{ duration: 0.2 }}
//             className="p-5 flex flex-col gap-5"
//           >
//             {/* Split layout: Stats on Left, Profile & Name on Right */}
//             <div className="flex flex-row gap-5">
              
//               {/* Left Side: Stats Grid (min-w-0 ensures the flexbox doesn't stretch past boundaries) */}
//               <div className="flex-1 grid grid-cols-2 gap-2.5 min-w-0">
//                 <StatCard label="Class" value={className} />
//                 <StatCard label="Role" value={role} />
//                 <StatCard label="Region" value={region} />
//                 <StatCard label="Status" value={status} />
//                 <StatCard label="Guild" value={guild} className="col-span-2" />
//               </div>

//               {/* Right Side: Large Profile & Name */}
//               <div className="w-[110px] flex flex-col items-center justify-center gap-3 flex-shrink-0">
//                 {/* The big avatar that morphed from the small one */}
//                 <motion.div 
//                   layoutId="profile-avatar"
//                   className="w-20 h-20 rounded-full border-[3px] border-[#a855f7]/80 bg-[#0e1c41] shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center relative overflow-hidden group"
//                 >
//                   {profilePicUrl ? (
//                      <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
//                   ) : (
//                      <span className="text-3xl font-black text-[#818cf8]">
//                        {name.charAt(0)}
//                      </span>
//                   )}
//                 </motion.div>
                
//                 <span className="text-lg font-bold text-gray-100 text-center leading-tight">
//                   {name}
//                 </span>
//               </div>

//             </div>

//             {/* Bottom: Modern XP Bar - Sung Jin Woo Colors */}
//             <div className="w-full flex flex-col items-center gap-1.5 border-t border-[#1e293b] pt-4 mt-1">
//               <div className="w-full h-2.5 bg-[#0e1c41] rounded-full overflow-hidden shadow-inner relative border border-[#1e293b]">
//                 <motion.div 
//                   className='absolute top-0 left-0 h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]'
//                   initial={{ width: 0 }}
//                   animate={{ width: `${xpPercentage}%` }}
//                   transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
//                 />
//               </div>
//               <div className="w-full flex justify-between px-1">
//                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NEXT LEVEL {Math.floor(xpPercentage)}%</span>
//                 <span className="text-[10px] font-mono text-[#a855f7]">{currentXp}/{maxXp} XP</span>
//               </div>
//             </div>

//           </motion.div>
//         )}
//       </AnimatePresence>

//     </motion.div>
//   )
// }


// function StatCard({ label, value, className = "" }: { label: string; value: string; className?: string }) {
//   return (
//     <div className={`flex flex-col gap-0.5 p-2.5 bg-[#0e1c41]/40 border border-[#1e293b] border-t-2 border-t-[#8b5cf6] rounded-lg shadow-sm overflow-hidden ${className}`}>
//       <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">{label}</span>
//       <span className="text-sm font-bold text-gray-100 truncate">{value}</span>
//     </div>
//   )
// }

"use client"
import React from 'react'
import { motion } from "motion/react"

const COLLAPSED_HEIGHT = 56;

export default function Nav({ 
  name = "Pranav Dubey", 
  profilePicUrl = "" 
}: {
  name?: string;
  role?: string;
  className?: string;
  region?: string;
  status?: string;
  guild?: string;
  currentXp?: number;
  maxXp?: number;
  profilePicUrl?: string;
}) {
  return (
    <motion.div 
      // Switched to a simple, static size with a subtle hover scale
      className='absolute top-8 right-8 bg-[#050505]/90 backdrop-blur-2xl overflow-hidden z-50 flex flex-col cursor-pointer shadow-2xl transition-transform duration-300 hover:scale-[1.02] group'
      style={{ borderRadius: '100px', width: 220, height: COLLAPSED_HEIGHT }}
    >
      {/* Mage-style thin gradient border wrapper */}
      <div className="absolute inset-0 rounded-inherit pointer-events-none p-[1px] bg-gradient-to-r from-pink-500/40 via-violet-500/40 to-indigo-500/40 [mask-image:linear-gradient(#fff_0_0)] [mask-composite:exclude]" style={{ WebkitMaskComposite: 'xor', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)' }}></div>
      
      {/* Base border fallback with a subtle brighten on hover */}
      <div className="absolute inset-0 rounded-inherit border border-white/10 group-hover:border-white/20 transition-colors duration-300 pointer-events-none"></div>

      {/* --- CAPSULE CONTENT --- */}
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <span className="text-sm font-medium text-gray-200 tracking-wide">
          {name}
        </span>
        
        <div className="w-10 h-10 rounded-full bg-[#111] flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/20">
          {profilePicUrl ? (
             <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
             <span className="text-white font-medium text-xs">{name.charAt(0)}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}