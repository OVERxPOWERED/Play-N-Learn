// import React from 'react';

// interface ChapterCardProps {
//   chapterNumber: string;
//   content: string;
// }

// export default function ChapterCard({ chapterNumber, content }: ChapterCardProps) {
//   return (
//     <div className="relative min-w-[280px] w-72 h-80 p-6 rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] group cursor-pointer overflow-hidden flex flex-col">
      
//       {/* Decorative top-left tech accent */}
//       {/* <div className="absolute top-0 left-0 w-10 h-1 bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" /> */}

//       {/* Header */}
//       <h3 className="text-xl font-bold text-slate-100 tracking-widest font-mono mb-4 border-b border-slate-700/50 pb-3 group-hover:border-cyan-500/50 transition-colors">
//         {chapterNumber}
//       </h3>

//       {/* Story Content */}
//       <p className="text-slate-400 text-sm font-mono leading-relaxed flex-grow">
//         {content}
//       </p>

//       {/* Game-style "Read More" indicator */}
//       <div className="mt-4 flex items-center justify-end text-xs text-cyan-400 font-mono opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
//         <span>LOAD_DATA</span>
//         <span className="ml-1 animate-pulse">_</span>
//       </div>
//     </div>
//   );
// }


import React from 'react';

interface ChapterCardProps {
  chapterNumber: string;
  content: string;
}

export default function ChapterCard({ chapterNumber, content }: ChapterCardProps) {
  return (
    <div className="group relative w-64 h-48 flex flex-col justify-between p-6 bg-[#080808] border border-white/5 hover:border-white/20 transition-all duration-500 cursor-pointer overflow-hidden">
      
      {/* Subtle Mage gradient background reveal on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-violet-500/0 group-hover:from-pink-500/[0.04] group-hover:to-violet-500/[0.06] transition-all duration-500" />

      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-xs font-semibold text-gray-200 tracking-[0.15em] uppercase mb-3">
          {chapterNumber}
        </h3>
        <p className="text-[12px] text-gray-500 leading-relaxed font-light line-clamp-4 group-hover:text-gray-400 transition-colors duration-300">
          {content}
        </p>
      </div>

      {/* Minimalist Arrow Indicator */}
      <div className="relative z-10 flex justify-end items-center mt-4">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 mr-2 -translate-x-2 group-hover:translate-x-0">
          Open
        </span>
        <span className="text-gray-500 group-hover:text-pink-400 transition-all duration-300 transform group-hover:translate-x-1">
          →
        </span>
      </div>
      
    </div>
  );
}