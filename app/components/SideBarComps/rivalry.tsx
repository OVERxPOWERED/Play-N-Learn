"use client"
import React, { useState } from 'react'

export default function Rivalry() {
  // Mocking the data to match the image structure
  const [data, setData] = useState({
    player1: {
      name: "Pranav Dubey",
      guild: "Magnm",
      tasksCompleted: 19,
      tasksTotal: 25
    },
    player2: {
      name: "OverXPowered",
      guild: "Magnm",
      tasksCompleted: 19,
      tasksTotal: 25
    }
  });

  return (
    <div className="flex flex-col gap-3 font-sans w-full">
      {/* Header */}
      <h2 className="text-2xl text-white tracking-wide mb-1">
        Active Rival
      </h2>

      {/* Rivalry Card */}
      {/* Reduced padding, adjusted rounding to fit sidebar scale */}
      <div className="bg-[#5a0808] rounded-xl px-4 py-3 flex items-center justify-between w-full shadow-lg relative overflow-hidden">
        
        {/* Left Side: Player 1 */}
        <div className="flex flex-col flex-1 z-10 overflow-hidden">
          <span className="text-sm font-medium text-white leading-tight truncate pr-2">
            {data.player1.name}
          </span>
          <span className="text-white/50 text-[10px] leading-tight mb-1">
            {data.player1.guild}
          </span>
          <span className="text-white text-[10px] mt-1">
            Task: {data.player1.tasksCompleted}/{data.player1.tasksTotal}
          </span>
          {/* Progress Bar Track */}
          <div className="w-[85%] h-1.5 bg-[#050505] rounded-full mt-1 overflow-hidden shadow-inner">
             {/* Dynamic fill example */}
             <div className="h-full bg-black/50 rounded-full" style={{ width: `${(data.player1.tasksCompleted / data.player1.tasksTotal) * 100}%` }}></div>
          </div>
        </div>

        {/* Center: VS Emblem */}
        {/* Drastically reduced size to 50px so it fits the sidebar */}
        <div className="relative flex flex-col items-center justify-center w-14 h-14 shrink-0 z-20 mx-2">
            <div className="w-[46px] h-[46px] rounded-full flex flex-col items-center justify-center bg-gradient-to-r from-black via-orange-600 to-[#00b4d8] border border-yellow-600/50 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
               <span className="text-[13px] font-black italic text-white drop-shadow-md leading-none mt-1" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>
                 VS
               </span>
               <div className="bg-gradient-to-b from-yellow-200 to-yellow-600 px-[3px] rounded-[2px] mt-[1px] shadow-sm">
                 <span className="block text-[5px] font-black text-black uppercase tracking-widest leading-none">
                   Battle
                 </span>
               </div>
            </div>
        </div>

        {/* Right Side: Player 2 */}
        <div className="flex flex-col flex-1 z-10 overflow-hidden">
          <span className="text-sm font-medium text-white leading-tight truncate pr-2">
            {data.player2.name}
          </span>
          <span className="text-white/50 text-[10px] leading-tight mb-1">
            {data.player2.guild}
          </span>
          <span className="text-white text-[10px] mt-1">
            Task: {data.player2.tasksCompleted}/{data.player2.tasksTotal}
          </span>
          {/* Progress Bar Track */}
          <div className="w-[85%] h-1.5 bg-[#050505] rounded-full mt-1 overflow-hidden shadow-inner">
             {/* Dynamic fill example */}
             <div className="h-full bg-black/50 rounded-full" style={{ width: `${(data.player2.tasksCompleted / data.player2.tasksTotal) * 100}%` }}></div>
          </div>
        </div>

      </div>
    </div>
  )
}