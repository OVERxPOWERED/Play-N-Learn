import React, { use } from 'react'
import Link from 'next/link'
import Nav from '../Navigation/Nav'
import Stats from '@/app/components/SideBarComps/Stats'
import Badges from '@/app/components/SideBarComps/Badges';
import useGetStats from '@/hooks/useGetStats';
import StorySection from '../SideBarComps/StorySection/Story';
import Rivalry from '../SideBarComps/rivalry';
import { Grainient, FaultyTerminal } from '@/app/components/background'

export default function Home() {
  const userStats = useGetStats('Developer')

  return (
    <>
      {/* 1. True black background with clean sans-serif text base */}
      <div className='h-screen w-screen relative bg-[#030303fc] flex overflow-hidden font-sans text-white'>


        {/* 
      Solo Leveling color palette

      #181817 – Deep black
      #0a1543 – Dark navy blue
      #19327f – Medium-dark blue
      #021fa0 – Vivid deep blue
      #1b45d7 – Bright royal blue      
      */}

        {/* <Grainient
          color1="#0a1543"
          color2="#27111c"
          color3="#181817"
          timeSpeed={0.65}
          colorBalance={0.2}
          warpStrength={4}
          warpFrequency={6.6}
          warpSpeed={2}
          warpAmplitude={80}
          blendAngle={-1}
          blendSoftness={0}
          rotationAmount={500}
          noiseScale={1.45}
          grainAmount={0}
          grainScale={8}
          grainAnimated
          contrast={1.05}
          gamma={1}
          saturation={1.2}
          centerX={0}
          centerY={0}
          zoom={0.85}
        /> */}

        <FaultyTerminal
          scale={1.5}
          gridMul={[2, 1]}
          digitSize={1.2}
          timeScale={0.5}
          pause={false}
          scanlineIntensity={0.5}
          glitchAmount={1}
          flickerAmount={1}
          noiseAmp={1}
          chromaticAberration={0}
          dither={0}
          curvature={0.1}
          tint="#2c2969"
          mouseReact
          mouseStrength={0.5}
          pageLoadAnimation
          brightness={0.6}
        />

        {/* 2. Mage-style Organic Ambient Glows */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] left-[30%] w-[50vw] h-[50vw] bg-violet-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-pink-600/10 rounded-full blur-[120px]"></div>
        </div>

        <Nav />

        {/* 3. Strict Geometric Layout (Tasks) */}
        <div id="tasks" className='flex-grow h-screen border-r border-white/[0.08] relative z-10'>
          {/* Task content will go here */}
        </div>

        {/* 4. Strict Geometric Layout (Sidebar) */}
        <div id="info" className='hidden lg:flex lg:w-[400px] h-full flex-col gap-8 overflow-y-auto px-6 pb-40 pt-32 relative z-10 bg-transparent backdrop-blur-md border-l border-white/[0.04] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:"none"] [scrollbar-width:"none"]'>

          {/* Stats Link Wrapper */}
          <Link href="/stats" className="relative block w-full shrink-0 group rounded overflow-hidden cursor-pointer">
            <Stats data={userStats} size={300} />
            {/* UPDATED: Applied custom hex #001433 at 50% opacity */}
            <div className="absolute inset-0 bg-[#2A296A]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"></div>
          </Link>

          <Link href="/rivalry" className="relative block w-full shrink-0 group rounded overflow-hidden cursor-pointer">
            <Rivalry />
            {/* UPDATED: Applied custom hex #001433 at 50% opacity */}
            <div className="absolute inset-0 bg-[#2A296A]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"></div>
          </Link>


          {/* Story Link Wrapper */}
          <Link href="/story" className="relative block w-full shrink-0 group rounded overflow-hidden cursor-pointer">
            <StorySection />
            {/* UPDATED: Applied custom hex #001433 at 50% opacity */}
            <div className="absolute inset-0 bg-[#2A296A]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"></div>
          </Link>

          {/* Badges Link Wrapper */}
          <Link href="/badges" className="relative block w-full shrink-0 group rounded-xl overflow-hidden cursor-pointer">
            <Badges />
            {/* UPDATED: Applied custom hex #001433 at 50% opacity */}
            <div className="absolute inset-0 bg-[#2A296A]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"></div>
          </Link>

        </div>

      </div>
    </>
  )
}