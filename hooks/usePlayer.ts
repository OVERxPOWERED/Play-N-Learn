// hooks/usePlayer.ts
import { useState, useEffect, useRef } from 'react'

export function usePlayer() {
    const [playerX, setPlayerX] = useState(5)
    const [playerY, setPlayerY] = useState(0)
    const [isMovingL, setIsMovingL] = useState(false)
    const [isMovingR, setIsMovingR] = useState(false)
    const [isJumping, setIsJumping] = useState(false)
    const [direction, setDirection] = useState<1 | -1>(1)

    const playerState = useRef({
        isJumping: false,
        playerXpos: 5
    })

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                setDirection(-1); setIsMovingL(true); setIsMovingR(false);
                setPlayerX((prev) => { const n = prev > 0 ? prev - 5 : prev; playerState.current.playerXpos = n; return n; });
            }
            if (e.key === 'ArrowRight') {
                setDirection(1); setIsMovingR(true); setIsMovingL(false);
                setPlayerX((prev) => { const n = prev < 95 ? prev + 5 : prev; playerState.current.playerXpos = n; return n; });
            }
            if ((e.key === 'ArrowUp' || e.code === 'Space') && !playerState.current.isJumping) {
                playerState.current.isJumping = true; setIsJumping(true); setPlayerY(-20);
                setTimeout(() => setPlayerY(0), 300);
                setTimeout(() => { playerState.current.isJumping = false; setIsJumping(false); }, 600);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                setIsMovingL(false); setIsMovingR(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return { playerX, playerY, isMovingL, isMovingR, isJumping, direction, playerState };
}