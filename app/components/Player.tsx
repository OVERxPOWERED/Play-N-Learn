'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface PlayerProps {
    xPos: number;
    yPos: number;
    isMovingL: boolean;
    isMovingR: boolean;
    isJumping: boolean;
    direction: 1 | -1;
}

export default function Player({ xPos = 0, yPos = 0, isMovingL, isMovingR, isJumping, direction }: PlayerProps) {
    const playerRef = useRef<HTMLDivElement>(null);

    // GSAP Movement Animation
    useGSAP(() => {
        gsap.to(playerRef.current, {
            x: `${xPos}vw`,
            y: `${yPos}vh`, 
            duration: 0.15,
            ease: "power1.out"
        });
    }, { 
        dependencies: [xPos, yPos]
    });

    // Determine which image to show based on the current state and direction
    let currentImage = '/spriteIdle.png'; // Default fallback

    if (isJumping) {
        // If jumping, check which way we were facing
        currentImage = direction === 1 ? '/spriteJump.png' : '/spriteJumpBack.png';
    } else if (isMovingR) {
        currentImage = '/spriteRun.png';
    } else if (isMovingL) {
        currentImage = '/spriteRunBack.png';
    } else {
        // If not jumping or moving, show the correct Idle frame
        currentImage = direction === 1 ? '/spriteIdle.png' : '/spriteIdleBack.png';
    }

    return (
        <div 
            ref={playerRef}
            className="absolute bottom-[30%] left-[0%] w-12 h-20 lg:w-24 lg:h-40"
            style={{ 
                backgroundImage: `url('${currentImage}')`,
                backgroundSize: 'contain',
                backgroundPosition: 'bottom center',
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
}