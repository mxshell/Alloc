import React, { useEffect, useState } from "react";

const AIRPORT_BOARD_ANIMATION_MS = 680;

interface AirportBoardValueProps {
    animateToken: number;
    className: string;
    formatter: (value: number) => string;
    shouldAnimate: boolean;
    value: number;
}

const scrambleBoardText = (target: string, progress: number) => {
    const normalizedProgress = Math.min(Math.max(progress, 0), 1);
    const lockCount = Math.floor(target.length * normalizedProgress);

    return target
        .split("")
        .map((char, index) => {
            const shouldLock = index < lockCount || !/[0-9]/.test(char);
            if (shouldLock) return char;
            return String(Math.floor(Math.random() * 10));
        })
        .join("");
};

const AirportBoardValue: React.FC<AirportBoardValueProps> = ({
    animateToken,
    className,
    formatter,
    shouldAnimate,
    value,
}) => {
    const targetText = formatter(value);
    const [displayText, setDisplayText] = useState(targetText);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!shouldAnimate) {
            setDisplayText(targetText);
            setIsAnimating(false);
            return;
        }

        const start = performance.now();
        let frameId = 0;

        setIsAnimating(true);

        const tick = (now: number) => {
            const progress = Math.min(
                (now - start) / AIRPORT_BOARD_ANIMATION_MS,
                1,
            );
            setDisplayText(scrambleBoardText(targetText, progress));

            if (progress < 1) {
                frameId = window.requestAnimationFrame(tick);
                return;
            }

            setDisplayText(targetText);
            setIsAnimating(false);
        };

        frameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [animateToken, shouldAnimate, targetText]);

    return (
        <span className={`${className} ${isAnimating ? "text-blue-100" : ""}`}>
            <span
                className={
                    isAnimating ? "inline-block animate-pulse" : "inline-block"
                }
            >
                {displayText}
            </span>
        </span>
    );
};

export default AirportBoardValue;
