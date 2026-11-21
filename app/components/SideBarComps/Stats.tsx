import React from 'react';
import { motion } from 'framer-motion';

// Renamed slightly for clarity, representing the props of the component
interface StatsProps {
    data: { label: string; value: number }[];
    size?: number;
}

export default function Stats({ data, size = 350 }: StatsProps) {
    const center = size / 2;
    const radius = (size / 2) * 0.65; // Leave room for labels
    const levels = 5; // Number of background grid hexagons

    // Calculate coordinates for a specific value and index
    const getPoint = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / data.length - Math.PI / 2;
        const r = (value / 100) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle),
        };
    };

    // Generate the path string for the actual data polygon
    const dataPath = data
        .map((d, i) => {
            const { x, y } = getPoint(d.value, i);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ') + ' Z';

    // Generate a collapsed path (all points at the center) for the initial animation state
    const centerPath = data
        .map((_, i) => {
            const { x, y } = getPoint(0, i);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ') + ' Z';

    return (
        <div className="flex flex-col h-fit w-full items-center justify-center font-sans">  

            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                
                {/* Sleek Gradient Definition for the Data Polygon */}
                <defs>
                    <linearGradient id="mage-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" /> {/* Pink */}
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" /> {/* Violet */}
                    </linearGradient>
                </defs>

                {/* Outer Restraining Boundary (Ultra-thin) */}
                <circle cx={center} cy={center} r={radius + 40} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.05" />

                {/* Background Grid (Hexagons) - Sharp and minimal */}
                {[...Array(levels)].map((_, levelIndex) => {
                    const levelValue = ((levelIndex + 1) / levels) * 100;
                    const levelPath = data
                        .map((_, i) => {
                            const { x, y } = getPoint(levelValue, i);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ') + ' Z';

                    return (
                        <path
                            key={levelIndex}
                            d={levelPath}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1"
                            opacity={levelIndex === levels - 1 ? "0.15" : "0.05"}
                        />
                    );
                })}

                {/* Axis Lines - Faint geometric structure */}
                {data.map((_, i) => {
                    const { x, y } = getPoint(100, i);
                    return (
                        <line key={`axis-${i}`} x1={center} y1={center} x2={x} y2={y} stroke="#ffffff" strokeWidth="1" opacity="0.05" />
                    );
                })}

                {/* The Data Polygon - Animated with Framer Motion */}
                <motion.path
                    initial={{ d: centerPath, opacity: 0 }}
                    animate={{ d: dataPath, opacity: 1 }}
                    transition={{ 
                        duration: 1, 
                        ease: [0.16, 1, 0.3, 1] // Custom spring-like easing
                    }}
                    fill="url(#mage-gradient)"
                    stroke="#e879f9"
                    strokeWidth="1.5"
                />

                {/* Data Points - Animated to expand out alongside the polygon */}
                {data.map((d, i) => {
                    const { x, y } = getPoint(d.value, i);
                    return (
                        <motion.circle 
                            key={`point-${i}`} 
                            initial={{ cx: center, cy: center, opacity: 0 }}
                            animate={{ cx: x, cy: y, opacity: 1 }}
                            transition={{ 
                                duration: 1, 
                                ease: [0.16, 1, 0.3, 1],
                                delay: 0.1 // Slight delay so the path starts slightly before the dots
                            }}
                            r="2.5" 
                            fill="#ffffff" 
                        />
                    );
                })}

                {/* Text Labels - Clean, muted sans-serif */}
                {data.map((d, i) => {
                    // Push text slightly further out
                    const { x, y } = getPoint(120, i);
                    
                    // Fixed text anchor logic
                    let textAnchor: "middle" | "start" | "end" = "middle";
                    if (x < center - 15) textAnchor = "end";
                    if (x > center + 15) textAnchor = "start";

                    return (
                        <motion.text
                            key={`label-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }} // Fade in labels after shape expands
                            x={x}
                            y={y}
                            fill="#9ca3af" // text-gray-400 equivalent
                            fontSize="10"
                            fontWeight="500"
                            textAnchor={textAnchor}
                            alignmentBaseline="middle"
                            className="tracking-[0.1em] uppercase"
                        >
                            {d.label}
                        </motion.text>
                    );
                })}
            </svg>
        </div>
    );
};