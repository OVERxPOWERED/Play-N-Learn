// import React from 'react';
// import ChapterCard from './ChapterCard';

// export default function StorySection() {

//   const chapters = [
//     {
//       id: 1,
//       chapterNumber: "Chapter 1",
//       content: "This Journey Starts in the small town in india known as Indore. Pranav lived a peacefull li ..."
//     },
//     {
//       id: 2,
//       chapterNumber: "Chapter 2",
//       content: "After long 3 years Pranav Joined the Acropolis Institute of Technology and Research, He ..."
//     },
//     {
//       id: 3,
//       chapterNumber: "Chapter 3",
//       content: "After long 3 years Pranav Joined the Acropolis Institute of Technology and Research, He ..."
//     },
//     {
//       id: 4,
//       chapterNumber: "Chapter 4",
//       content: "After long 3 years Pranav Joined the Acropolis Institute of Technology and Research, He ..."
//     }
//   ];

//   return (
//     <section className="relative shrink-0 w-full max-w-5xl mx-auto p-8 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
      
//       {/* Optional: Subtle scanline overlay for the container */}
//       <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_4px]" />

//       {/* Section Header */}
//       <div className="mb-8 flex items-center">
//         <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse mr-3 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
//         <h2 className="text-sm text-indigo-300 font-mono tracking-[0.2em] uppercase">
//           Your Journey
//         </h2>
//       </div>

//       {/* Horizontal Scroll Container (Scrollbars hidden via CSS) */}
//       <div className="flex gap-6 overflow-x-auto py-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
//         {chapters.map((chapter) => (
//           <div key={chapter.id} className="snap-center">
//             <ChapterCard
//               chapterNumber={chapter.chapterNumber}
//               content={chapter.content}
//             />
//           </div>
//         ))}
//       </div>

//       {/* Animated Scroll Prompt */}
//       <div className="mt-6 flex justify-center items-center gap-3 text-slate-500 font-mono text-xs tracking-widest uppercase opacity-70">
//         <span className="animate-pulse">&lt;--</span>
//         Scroll to see more
//         <span className="animate-pulse">--&gt;</span>
//       </div>
      
//     </section>
//   );
// }

import React from 'react';
import ChapterCard from './ChapterCard';

export default function StorySection() {

  const chapters = [
    {
      id: 1,
      chapterNumber: "Chapter 1",
      content: "This Journey Starts in the small town in India known as Indore. Pranav lived a peaceful life but always felt a calling for something greater..."
    },
    {
      id: 2,
      chapterNumber: "Chapter 2",
      content: "After 3 long years, Pranav joined the Acropolis Institute of Technology and Research. Here, the real challenges began to unfold..."
    },
    {
      id: 3,
      chapterNumber: "Chapter 3",
      content: "Discovering the power of code, he began architecting systems that connected the digital world to reality, starting his developer journey."
    },
    {
      id: 4,
      chapterNumber: "Chapter 4",
      content: "The final stretch. Facing down bugs, deadlines, and the sheer weight of production deployment. The true test of a developer."
    }
  ];

  return (
    <section className="relative shrink-0 w-full flex flex-col font-sans mb-4">
      
      {/* Minimalist Header (Matching the Stats section) */}
      <div className="w-full flex items-center mb-6">
        <h2 className="text-[11px] font-semibold text-white/50 tracking-[0.2em] uppercase">
          My Journey
        </h2>
        <div className="ml-4 flex-grow h-[1px] bg-white/5"></div>
      </div>

      {/* Scroll Area Wrapper */}
      <div className="relative w-full">
        
        {/* Horizontal Scroll Container */}
        {/* Using snap-start and standard padding to ensure crisp scrolling */}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {chapters.map((chapter) => (
            <div key={chapter.id} className="snap-start shrink-0 first:pl-1 last:pr-8">
              <ChapterCard
                chapterNumber={chapter.chapterNumber}
                content={chapter.content}
              />
            </div>
          ))}
        </div>

        {/* Elegant Right-Side Fade */}
        {/* This creates a soft gradient masking effect on the right edge to imply scrollable content */}
        <div className="absolute top-0 right-0 bottom-4 w-12 bg-gradient-to-l from-[#030303] to-transparent pointer-events-none z-10" />
      </div>
      
    </section>
  );
}