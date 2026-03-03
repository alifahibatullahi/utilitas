'use client';

import { useEffect, useState, useId } from 'react';
import { getAlertStatus } from '@/lib/utils';

interface CylinderTankProps {
    level: number;
    liquidColor: string;
    liquidColorLight: string;
    gradientFrom: string;
    gradientTo: string;
    tankName: string;
    capacity: string;
}

export default function CylinderTank({
    level,
    liquidColor,
    liquidColorLight,
    gradientFrom,
    gradientTo,
    tankName,
    capacity,
}: CylinderTankProps) {
    const [animatedLevel, setAnimatedLevel] = useState(0);
    const uniqueId = useId();
    const alertStatus = getAlertStatus(level);

    useEffect(() => {
        const timeout = setTimeout(() => setAnimatedLevel(level), 100);
        return () => clearTimeout(timeout);
    }, [level]);

    // SVG dimensions
    const width = 180;
    const height = 340;
    const tankX = 30;
    const tankWidth = 120;
    const tankTop = 30;
    const tankBottom = 300;
    const tankHeight = tankBottom - tankTop;
    const liquidHeight = (animatedLevel / 100) * tankHeight;
    const liquidY = tankBottom - liquidHeight;
    const ellipseRy = 12;

    // Scale markings
    const scaleMarks = [0, 20, 40, 60, 80, 100];

    // Glow effect based on alert
    const glowColor = alertStatus === 'critical'
        ? 'rgba(239, 68, 68, 0.6)'
        : alertStatus === 'warning'
            ? 'rgba(234, 179, 8, 0.4)'
            : 'rgba(34, 197, 94, 0.25)';

    const safeId = uniqueId.replace(/:/g, '_');

    return (
        <div className="flex flex-col items-center">
            <svg
                width={width}
                height={height + 10}
                viewBox={`0 0 ${width} ${height + 10}`}
                className="drop-shadow-lg"
            >
                <defs>
                    {/* Liquid gradient */}
                    <linearGradient id={`liquid-grad-${safeId}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={gradientFrom} />
                        <stop offset="100%" stopColor={gradientTo} />
                    </linearGradient>
                    {/* Glass highlight */}
                    <linearGradient id={`glass-${safeId}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                        <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
                        <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                    </linearGradient>
                    {/* Glow filter */}
                    <filter id={`glow-${safeId}`} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feFlood floodColor={glowColor} result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="glow" />
                        <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Clip for liquid inside tank */}
                    <clipPath id={`tank-clip-${safeId}`}>
                        <rect x={tankX} y={tankTop + ellipseRy} width={tankWidth} height={tankHeight - ellipseRy * 2} rx="0" />
                        <ellipse cx={tankX + tankWidth / 2} cy={tankTop + ellipseRy} rx={tankWidth / 2} ry={ellipseRy} />
                        <ellipse cx={tankX + tankWidth / 2} cy={tankBottom - ellipseRy} rx={tankWidth / 2} ry={ellipseRy} />
                    </clipPath>
                </defs>

                <g filter={`url(#glow-${safeId})`}>
                    {/* Tank body (transparent glass) */}
                    <rect
                        x={tankX}
                        y={tankTop + ellipseRy}
                        width={tankWidth}
                        height={tankHeight - ellipseRy * 2}
                        fill="rgba(30, 41, 59, 0.6)"
                        stroke="rgba(148, 163, 184, 0.3)"
                        strokeWidth="1.5"
                    />

                    {/* Tank top ellipse */}
                    <ellipse
                        cx={tankX + tankWidth / 2}
                        cy={tankTop + ellipseRy}
                        rx={tankWidth / 2}
                        ry={ellipseRy}
                        fill="rgba(30, 41, 59, 0.6)"
                        stroke="rgba(148, 163, 184, 0.3)"
                        strokeWidth="1.5"
                    />

                    {/* Tank bottom ellipse */}
                    <ellipse
                        cx={tankX + tankWidth / 2}
                        cy={tankBottom - ellipseRy}
                        rx={tankWidth / 2}
                        ry={ellipseRy}
                        fill="rgba(30, 41, 59, 0.6)"
                        stroke="rgba(148, 163, 184, 0.3)"
                        strokeWidth="1.5"
                    />

                    {/* Liquid fill */}
                    <g clipPath={`url(#tank-clip-${safeId})`}>
                        <rect
                            x={tankX}
                            y={liquidY}
                            width={tankWidth}
                            height={tankBottom - liquidY}
                            fill={`url(#liquid-grad-${safeId})`}
                            className="transition-all duration-1000 ease-out"
                        />
                        {/* Liquid top surface ellipse */}
                        <ellipse
                            cx={tankX + tankWidth / 2}
                            cy={liquidY}
                            rx={tankWidth / 2}
                            ry={ellipseRy}
                            fill={liquidColorLight}
                            opacity="0.7"
                            className="transition-all duration-1000 ease-out"
                        />
                    </g>

                    {/* Glass highlight overlay */}
                    <rect
                        x={tankX}
                        y={tankTop + ellipseRy}
                        width={tankWidth}
                        height={tankHeight - ellipseRy * 2}
                        fill={`url(#glass-${safeId})`}
                    />
                </g>

                {/* Scale markings (sight glass) */}
                {scaleMarks.map((mark) => {
                    const y = tankBottom - ellipseRy - ((mark / 100) * (tankHeight - ellipseRy * 2));
                    return (
                        <g key={mark}>
                            <line
                                x1={tankX + tankWidth + 5}
                                y1={y}
                                x2={tankX + tankWidth + 12}
                                y2={y}
                                stroke="rgba(148, 163, 184, 0.5)"
                                strokeWidth="1"
                            />
                            <text
                                x={tankX + tankWidth + 16}
                                y={y + 4}
                                fill="#94a3b8"
                                fontSize="10"
                                fontFamily="monospace"
                            >
                                {mark}%
                            </text>
                        </g>
                    );
                })}

                {/* Percentage text in center */}
                <text
                    x={tankX + tankWidth / 2}
                    y={(tankTop + tankBottom) / 2 - 5}
                    textAnchor="middle"
                    fill="white"
                    fontSize="32"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                >
                    {level.toFixed(1)}
                </text>
                <text
                    x={tankX + tankWidth / 2}
                    y={(tankTop + tankBottom) / 2 + 18}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize="14"
                    fontWeight="500"
                >
                    %
                </text>
            </svg>

            {/* Tank name + capacity */}
            <div className="text-center mt-1">
                <p className="text-base font-semibold text-slate-100">
                    {tankName} <span className="text-slate-400 font-normal text-sm">– {capacity}</span>
                </p>
            </div>
        </div>
    );
}
