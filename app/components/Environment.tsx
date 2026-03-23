'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation' // <-- NEW: For redirecting
import { signIn } from 'next-auth/react' // NextAuth client helper
import CinematicReveal from './Cinematic-reveal'
import Player from './Player'
import Block from './Block'
// import LoginPage from '@/app/components/login'

// 1. Define your Level Data
// Adjust the 'y' values (top percentage) so they float above your 30% ground line
// const LOGIN_PROVIDERS = [
//     { id: 'google', icon: '/icons/google.png', x: 20, y: 50 },
//     { id: 'github', icon: '/icons/github.png', x: 40, y: 35 },
//     { id: 'discord', icon: '/icons/discord.png', x: 60, y: 50 },
//     { id: 'email', icon: '/icons/email.png', x: 80, y: 35 },
// ]

const LOGIN_PROVIDERS = [
    { 
        id: 'google', 
        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg', 
        x: 20, 
        y: 50 
    },
    { 
        id: 'github', 
        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg', 
        x: 40, 
        y: 35 
    },
    { 
        id: 'discord', 
        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/discord/discord-original.svg', 
        x: 60, 
        y: 50 
    },
    { 
        id: 'email', 
        // A generic high-quality online email icon
        icon: 'https://cdn-icons-png.flaticon.com/512/732/732200.png', 
        x: 80, 
        y: 35 
    },
]


export default function Environment() {
    const router = useRouter() // <-- NEW: Initialize the router
    const worldRef = useRef<HTMLDivElement>(null)

    const [playerX, setPlayerX] = useState(5)
    const [playerY, setPlayerY] = useState(0)

    // New states to pass down to the Player for animation
    const [isMovingL, setIsMovingL] = useState(false)
    const [isMovingR, setIsMovingR] = useState(false)

    const [isJumping, setIsJumping] = useState(false)
    const [direction, setDirection] = useState<1 | -1>(1) // 1 = right, -1 = left

    const playerState = useRef({
        isJumping: false,
        playerXpos: 0
    })

    // 2. The function that handles the routing when a block breaks
    const handleLoginTrigger = (providerId: string) => {
        console.log(`Player smashed the ${providerId} block! Initiating NextAuth...`)

        if (providerId === 'email') {
            // For email magic-links with NextAuth Email Provider, use `signIn('email')`
            // or send the user to your custom email login page. This sample uses direct signIn.
            signIn('email', { callbackUrl: '/dashboard' })
        } else {
            // OAuth providers (Google/GitHub/Discord) are handled automatically by NextAuth
            signIn(providerId, { callbackUrl: '/dashboard' })
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'A' || e.key === 'a') {
                setDirection(-1);
                setIsMovingL(true);
                setIsMovingR(false);
                setPlayerX((prevX) => {
                    const newX = prevX > 0 ? prevX - 5 : prevX;
                    playerState.current.playerXpos = newX;
                    return newX;
                });
            }
            if (e.key === 'D' || e.key === 'd') {
                setDirection(1);
                setIsMovingR(true);
                setIsMovingL(false);
                setPlayerX((prevX) => {
                    const newX = prevX < 90 ? prevX + 5 : prevX;
                    playerState.current.playerXpos = newX;
                    return newX;
                });
            }

            if ((e.key === 'ArrowUp' || e.code === 'Space') && !(playerState.current.isJumping)) {
                playerState.current.isJumping = true;
                setIsJumping(true); 
                setPlayerY(-20);

                setTimeout(() => {
                    setPlayerY(0);
                }, 300);

                setTimeout(() => {
                    playerState.current.isJumping = false;
                    setIsJumping(false); 
                }, 500);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                setIsMovingL(false);
                setIsMovingR(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <div ref={worldRef} id='world' className='flex flex-col h-full w-full overflow-hidden relative'>
            <CinematicReveal />
            
            <Player 
                xPos={playerX} 
                yPos={playerY} 
                isMovingL={isMovingL} 
                isMovingR={isMovingR}
                isJumping={isJumping} 
                direction={direction} 
            />

            {/* 3. Render the Login Blocks dynamically */}
            {LOGIN_PROVIDERS.map((provider) => (
                <Block 
                    key={provider.id}
                    x={provider.x} 
                    y={provider.y} 
                    iconSrc={provider.icon} // Pass the icon down
                    playerState={playerState} 
                    onBreak={() => handleLoginTrigger(provider.id)} // Pass the trigger down
                />
                // <LoginPage />
            ))}

            <div
                style={{ 
                    backgroundImage: "url('/sky.jpg')",
                    backgroundSize: 'contain',
                }}
                id="sky"
                className="w-full h-[70%] bg-sky-500 bg-center "
            ></div>
            <div
            style={{
                background: "url('/ground.jpg')",
                backgroundSize: 'cover',
            }}
            id="ground" className="w-full h-[30%] bg-green-500"></div>
        </div>
    )
}