'use client'
import React, { useState } from 'react'
import Environment from './Environment'
import CinematicReveal from './Cinematic-reveal' // Make sure this path is correct

export default function Phone() {
    // 1. The Master State: Tracks the current level/page
    const [stage, setStage] = useState('LOGIN');

    // 2. A dictionary mapping the stage to the text you want displayed
    const STAGE_HEADINGS: Record<string, string> = {
        'LOGIN': 'LOGIN',
        'PREF_1': 'ROLES',
        'PREF_2': 'TRACKING'
    };

    return (
        // Outer container: Centers the phone in the middle of your browser
        <div className="flex items-center justify-center h-[calc(100vh-2rem)] w-screen bg-slate-900  border-10 border-black overflow-hidden">
            <CinematicReveal
                key={stage}
                heading={STAGE_HEADINGS[stage]}
            />        
            {/* Device Wrapper: Needed to hold buttons outside the overflow-hidden chassis */}
            <div className="relative lg:w-[95%] lg:h-[90%] w-full h-full">

                {/* Hardware Buttons (Top Edge) */}
                {/* Power Button */}
                <div className="absolute hidden lg:block  -top-2 left-21 w-21 h-3 bg-black rounded-t-md shadow-sm z-50"></div>
                {/* Volume Up */}
                <div className="absolute hidden lg:block -top-2 left-55 w-17 h-3 bg-black rounded-t-md shadow-sm z-50"></div>
                {/* Volume Down */}
                <div className="absolute hidden lg:block -top-2 left-75 w-17 h-3 bg-black rounded-t-md shadow-sm z-50"></div>

                {/* The Phone Chassis (Landscape Dimensions) */}
                <div className="relative w-full h-full bg-black lg:rounded-[3rem] lg:border-[10px] lg:border-black lg:shadow-[0_5px_30px_#724532,0_-5px_30px_#5fb9c6] overflow-hidden flex">

                    {/* The Camera Notch (Centered horizontally on the left edge) */}
                    <div className="absolute hidden lg:block left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black rounded-full z-50"></div>

                    {/* The Phone Screen / Game Container */}
                    <div className="w-full h-full bg-white relative overflow-hidden ">

                        {/* 3. THE MAGIC:
                            We put CinematicReveal inside the screen. 
                            By using key={stage}, it completely restarts the 6-second 
                            animation every time the stage changes!
                        */}


                        {/* 4. We pass the stage down to Environment so it knows what blocks to draw, 
                            and a function to change the stage when a block breaks */}
                        <Environment
                            currentStage={stage}
                            onStageChange={setStage}
                        />

                    </div>

                </div>
            </div>

        </div>
    )
}