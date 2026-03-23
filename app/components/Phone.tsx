'use client'
import React from 'react'
import Environment from './Environment'

export default function Phone() {
  return (
    // Outer container: Centers the phone in the middle of your browser
    <div className="flex items-center justify-center h-screen w-screen bg-slate-900 overflow-hidden">
        
      
      {/* The Phone Chassis (Landscape Dimensions) */}
      <div 
        // Swapped width and height: w-[720px] h-[340px]
        className="relative w-[95%] h-[90%] bg-black rounded-[3rem] border-[10px] border-black shadow-[0_5px_30px_#724532,0_-5px_30px_#5fb9c6] overflow-hidden flex"
        style={{ animation: 'float 6s ease-in-out infinite' }} 
      >
        <div className='text-white font-monospace absolute top-2 left-2 z-50'>
            <h1>LOGIN</h1>
        </div>
        {/* The Camera Notch (Moved to the left edge) */}
        <div className="absolute left-2 bottom-2 w-8 h-8 bg-black rounded-full z-50"></div>


        {/* The Phone Screen / Game Container */}
        <div className="w-full h-full bg-white relative overflow-hidden">
          <Environment />
        </div>

      </div>

    </div>
  )
}