// "use client"
// import React, { useState, useRef } from 'react'
// import { motion, AnimatePresence } from "motion/react"

// const MOCK_BADGES = [
//   {
//     id: 'badge-01',
//     title: 'Shadow Awakened',
//     icon: '👑',
//     coating: 'from-[#6366f1]/20 to-[#a855f7]/20 border-[#a855f7]/50' 
//   },
//   {
//     id: 'badge-02',
//     title: 'Beast Slayer',
//     icon: '🐺',
//     coating: 'from-blue-500/20 to-cyan-400/20 border-cyan-400/50'
//   }
// ];

// export default function Badges() {
//   const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
//   const [isHovering, setIsHovering] = useState(false);
//   const containerRef = useRef(null);

//   // Function to track mouse position relative to the container
//   const handleMouseMove = (e) => {
//     if (!containerRef.current) return;
//     const rect = containerRef.current.getBoundingClientRect();
//     setMousePos({
//       x: e.clientX - rect.left,
//       y: e.clientY - rect.top
//     });
//   };

//   return (
//     <div 
//       className="w-full flex flex-col gap-3"
//       style={{ fontFamily: '"Roboto Mono", monospace' }}
//     >
      
//       {/* HEADER: Big, Bold, Roboto Mono */}
//       <div className="px-2">
//         <h2 className="text-2xl font-black text-[#818cf8] tracking-widest uppercase">
//           Badges
//         </h2>
//       </div>

//       {/* UNIFIED WRAPPER: 
//         - Hovering anywhere here triggers the group glow.
//         - 'cursor-none' hides the default mouse so our custom text can take over.
//         - 'overflow-hidden' ensures nothing breaks the layout bounds.
//       */}
//       <a 
//         href="/badgebig" 
//         ref={containerRef}
//         onMouseEnter={() => setIsHovering(true)}
//         onMouseLeave={() => setIsHovering(false)}
//         onMouseMove={handleMouseMove}
//         className="relative block w-full outline-none group p-3 rounded-3xl transition-all duration-500 bg-transparent hover:bg-[#0f172a]/80 border border-transparent hover:border-[#38bdf8]/30 hover:shadow-[0_0_40px_rgba(56,189,248,0.15)] cursor-none overflow-hidden"
//       >
        
//         {/* CUSTOM CURSOR: Follows mouse position */}
//         <AnimatePresence>
//           {isHovering && (
//             <motion.div
//               className="absolute top-0 left-0 pointer-events-none z-50 bg-[#818cf8] text-[#030712] text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap shadow-[0_0_20px_rgba(129,140,248,0.6)]"
//               initial={{ opacity: 0, scale: 0.5 }}
//               animate={{ 
//                 opacity: 1, 
//                 scale: 1, 
//                 // Offset by 15px so the text isn't directly under the physical mouse click point
//                 x: mousePos.x + 15, 
//                 y: mousePos.y + 15 
//               }}
//               exit={{ opacity: 0, scale: 0.5 }}
//               transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.5 }}
//             >
//               Check out more ↗
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* GRID: Fixed height (h-[110px]) stops it from stretching and causing scrollbars */}
//         <div className="grid grid-cols-2 gap-4 relative z-10">
          
//           {MOCK_BADGES.map((badge) => (
//             <div 
//               key={badge.id}
//               className="relative flex flex-col items-center justify-center h-[110px] rounded-2xl bg-[#090f26] border border-[#1e293b] overflow-hidden transition-all duration-300 group-hover:border-[#6366f1]/50 group-hover:bg-[#0b1330] shadow-lg"
//             >
              
//               {/* The "Cool Coating" - Activates when the PARENT wrapper is hovered */}
//               <div 
//                 className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br border transition-all duration-500 z-10 ${badge.coating}`} 
//               />

//               {/* MOCK IMAGE */}
//               <div className="text-4xl mb-2 relative z-0 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-110">
//                 {badge.icon}
//               </div>

//               {/* Minimal Heading */}
//               <h3 className="text-[11px] font-bold text-gray-400 tracking-wider z-0 group-hover:text-white transition-colors duration-300">
//                 {badge.title}
//               </h3>

//               {/* Subtle background glow behind the image */}
//               <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 rounded-full scale-50" />

//             </div>
//           ))}

//         </div>
//       </a>
//     </div>
//   )
// }


// -----------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------ Section-1 ---------------------------------------------------------------------------------

// "use client"
// import React from 'react'

// const MOCK_BADGES = [
//   {
//     id: 'badge-01',
//     title: 'Shadow Awakened',
//     icon: '👑',
//     glowClass: 'group-hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]',
//     borderClass: 'group-hover:border-purple-500/50',
//     underlineColor: '#a855f7' // Purple
//   },
//   {
//     id: 'badge-02',
//     title: 'Task Slayer',
//     icon: '🐺',
//     glowClass: 'group-hover:shadow-[0_0_30px_rgba(14,165,233,0.4)]',
//     borderClass: 'group-hover:border-sky-500/50',
//     underlineColor: '#0ea5e9' // Sky Blue
//   }
// ];

// export default function Badges() {
//   return (
//     <div className="w-full flex flex-col gap-4" style={{ fontFamily: '"Roboto Mono", monospace' }}>
      
//       {/* HEADER */}
//       <div className="px-2 flex items-center justify-between">
//         <h2 className="text-sm font-bold text-slate-400 tracking-[0.2em] uppercase">
//           Unlocked Artifacts
//         </h2>
//         <span className="text-xs text-slate-600 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
//           2 / 24
//         </span>
//       </div>

//       {/* CONTAINER */}
//       <div className="w-full bg-[#0a0c10] border border-slate-800/60 rounded-2xl p-6 relative overflow-hidden">
        
//         {/* Subtle background dot grid for texture */}
//         <div className="absolute inset-0 opacity-20 pointer-events-none" 
//              style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '16px 16px' }} 
//         />

//         {/* BADGE GRID */}
//         <div className="grid grid-cols-2 gap-6 relative z-10 place-items-center mt-2 mb-2">
          
//           {MOCK_BADGES.map((badge) => (
//             <div 
//               key={badge.id}
//               className="group cursor-pointer flex flex-col items-center gap-4 w-full"
//             >
              
//               {/* 1. THE BEVELED BASE (Slightly scaled down to fit the text below) */}
//               <div className="relative w-24 h-24 flex items-center justify-center transition-transform duration-500 group-hover:-translate-y-2">
//                 <div 
//                   className={`absolute inset-0 rotate-45 rounded-[1.25rem] bg-gradient-to-br from-[#1e222e] via-[#141720] to-[#0d0f14] 
//                               border-[2px] border-slate-700/50 shadow-[8px_8px_16px_rgba(0,0,0,0.8),inset_2px_2px_4px_rgba(255,255,255,0.1),inset_-2px_-2px_4px_rgba(0,0,0,0.5)]
//                               transition-all duration-500 ${badge.glowClass} ${badge.borderClass} overflow-hidden`}
//                 >
//                    {/* The moving "sheen" reflection on hover */}
//                    <div className="absolute inset-0 -translate-x-[150%] skew-x-[-45deg] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:animate-[shimmer_1.5s_ease-in-out_infinite]" />
//                 </div>

//                 {/* THE EMBLEM */}
//                 <div className="relative z-10 text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform duration-500 ease-out">
//                   {badge.icon}
//                 </div>
//               </div>

//               {/* 2. THE EXHIBIT PLAQUE (New Text Placement) */}
//               <div className="flex flex-col items-center justify-center transition-transform duration-300 group-hover:translate-y-1">
//                 <span className="text-[10px] font-bold text-slate-500 tracking-[0.15em] uppercase text-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] transition-colors duration-300 group-hover:text-slate-200">
//                   {badge.title}
//                 </span>
                
//                 {/* Animated underline that expands on hover based on the badge's theme color */}
//                 <div 
//                   className="h-[2px] w-0 group-hover:w-full transition-all duration-500 mt-1 opacity-80 rounded-full"
//                   style={{ backgroundColor: badge.underlineColor, boxShadow: `0 0 8px ${badge.underlineColor}` }}
//                 />
//               </div>

//             </div>
//           ))}

//         </div>
//       </div>

//       {/* Add the shimmer animation keyframes locally */}
//       <style dangerouslySetInnerHTML={{__html: `
//         @keyframes shimmer {
//           100% { transform: translateX(150%) skewX(-45deg); }
//         }
//       `}} />

//     </div>
//   )
// }


// --------------------------------------- Section-2 ----------------------------------------------------------

"use client"
import React from 'react'

const MOCK_BADGES = [
  {
    id: 'badge-01',
    title: 'Shadow Awakened',
    icon: '👑',
    // Sheer, weightless Mage gradients for the hover state
    hoverGradient: 'from-pink-500/10 via-purple-500/10 to-violet-500/10',
    glowColor: 'rgba(236, 72, 153, 0.15)' // Faint pink glow
  },
  {
    id: 'badge-02',
    title: 'Task Slayer',
    icon: '🐺',
    hoverGradient: 'from-violet-500/10 via-indigo-500/10 to-blue-500/10',
    glowColor: 'rgba(139, 92, 246, 0.15)' // Faint violet glow
  }
];

export default function Badges() {
  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      
      {/* Minimalist Header (Matches Stats and Story) */}
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center flex-grow">
            <h2 className="text-[11px] font-semibold text-white/50 tracking-[0.2em] uppercase">
            Unlocked Artifacts
            </h2>
            <div className="ml-4 flex-grow h-[1px] bg-white/5"></div>
        </div>
        
        {/* Sleek Counter */}
        <span className="ml-4 text-[9px] font-medium text-gray-500 tracking-widest bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
          2 / 24
        </span>
      </div>

      {/* BADGE GRID - Stripped of the heavy background container */}
      <div className="grid grid-cols-2 gap-4 relative z-10 place-items-center">
        
        {MOCK_BADGES.map((badge) => (
          <div 
            key={badge.id}
            className="group cursor-pointer flex flex-col items-center gap-4 w-full"
          >
            
            {/* 1. The Container: Pitch black, 1px border, completely flat until hovered */}
            <div 
                className="relative w-20 h-20 rounded-2xl bg-[#050505] border border-white/5 flex items-center justify-center transition-all duration-500 overflow-hidden"
                style={{ 
                    // Dynamic soft shadow that only appears on hover
                    boxShadow: 'none' 
                }}
            >
                {/* 2. The Internal Hover Glow: Fades in smoothly */}
                <div 
                    className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${badge.hoverGradient} transition-opacity duration-700`} 
                />
                
                {/* 3. The Border Reveal: Fades the border slightly brighter on hover */}
                <div className="absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/10 transition-colors duration-500" />

                {/* THE EMBLEM: Desaturated by default, bursts into color and scales on hover */}
                <div 
                    className="relative z-10 text-3xl grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 ease-out drop-shadow-md"
                >
                    {badge.icon}
                </div>
            </div>

            {/* THE PLAQUE: Clean sans-serif, muting the text until interacted with */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium text-gray-600 tracking-[0.15em] uppercase text-center transition-colors duration-300 group-hover:text-gray-200">
                {badge.title}
              </span>
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}