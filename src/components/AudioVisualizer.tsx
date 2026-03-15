import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
    isActive?: boolean;
    barCount?: number;
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    isWindowFocused?: boolean;
}

export function AudioVisualizer({
    isActive = true,
    barCount = 48,
    className = '',
    orientation = 'horizontal',
    isWindowFocused = true
}: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const isMountedRef = useRef(true);
    const lastDrawTimeRef = useRef<number>(0);
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null); // Reuse buffer across frames
    const FPS_LIMIT = 30;
    const FRAME_INTERVAL = 1000 / FPS_LIMIT;

    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const visualize = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;

        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }); // optimize for frequent updates
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        // Reuse data buffer to avoid GC pressure (was allocating new Uint8Array every frame)
        if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
            dataArrayRef.current = new Uint8Array(bufferLength);
        }
        const dataArray = dataArrayRef.current;

        const draw = (timestamp: number) => {
            animationFrameRef.current = requestAnimationFrame(draw);

            // Throttle FPS
            const elapsed = timestamp - lastDrawTimeRef.current;
            if (elapsed < FRAME_INTERVAL) return;

            // Adjust for catch-up but cap it
            lastDrawTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);

            analyser.getByteFrequencyData(dataArray);

            // Clear canvas with the actual dimensions
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            ctx.clearRect(0, 0, width, height);

            if (orientation === 'horizontal') {
                const gap = 4;
                const barWidth = (width / barCount) - gap;

                // Sample the frequency data to match our bar count
                // Ensure step is at least 1 to prevent division by zero
                const step = Math.max(1, Math.floor(bufferLength / barCount));

                for (let i = 0; i < barCount; i++) {
                    // Average nearby frequency bins for smoother visualization
                    let sum = 0;
                    let count = 0;

                    for (let j = 0; j < step; j++) {
                        const index = i * step + j;
                        if (index < bufferLength) {
                            sum += dataArray[index];
                            count++;
                        }
                    }

                    // Avoid division by zero if count is 0 (shouldn't happen with step >= 1 logic but safe to check)
                    const value = count > 0 ? sum / count : 0;

                    // Apply scaling for visual effect - more dramatic response
                    const normalizedValue = Math.pow(value / 255, 0.6);
                    const minHeight = 6; // Minimum bar height
                    const barHeight = minHeight + (normalizedValue * (height - minHeight) * 0.95);

                    const x = i * (barWidth + gap) + gap / 2;
                    const y = height - barHeight;

                    // Create gradient - purple to cyan based on frequency position
                    const hue = 250 + (i / barCount) * 80;
                    const saturation = 70 + normalizedValue * 30;
                    const lightness = 45 + normalizedValue * 25;
                    const alpha = 0.7 + normalizedValue * 0.3;

                    // Create vertical gradient for each bar
                    const gradient = ctx.createLinearGradient(x, height, x, y);
                    gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness * 0.3}%, ${alpha * 0.3})`);
                    gradient.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`);
                    gradient.addColorStop(1, `hsla(${hue + 40}, ${saturation + 10}%, ${lightness + 20}%, ${alpha})`);

                    ctx.fillStyle = gradient;

                    // Draw bar with rounded top
                    ctx.beginPath();
                    const radius = Math.min(barWidth / 2, 8);
                    ctx.moveTo(x, height);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.lineTo(x + barWidth - radius, y);
                    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
                    ctx.lineTo(x + barWidth, height);
                    ctx.closePath();
                    ctx.fill();
                }
            } else {

                // VERTICAL ORIENTATION (Left side) - Symmetrical Waveform
                const gap = 4;
                const barHeight = (height / barCount) - gap;

                // Center line for symmetrical drawing
                const centerX = width / 2;
                const centerIndex = barCount / 2;

                // Use 75% of buffer for better visualization of common frequencies
                const usableBuffer = Math.floor(bufferLength * 0.75);
                const indicesPerBar = usableBuffer / (barCount / 2);

                // Check for dark mode to set bar color
                const hasDarkClass = document.documentElement.classList.contains('dark');

                for (let i = 0; i < barCount; i++) {
                    // Calculate distance from center (0 to 1)
                    const distFromCenter = Math.abs(i - centerIndex) / centerIndex;

                    // Map this position to frequency data
                    // Center = Low Freq (Bass), Edges = High Freq
                    // Use quadratic curve for mapping to give more resolution to mid/lows
                    const freqIndex = Math.floor((distFromCenter) * usableBuffer);

                    let sum = 0;
                    let count = 0;

                    const step = Math.max(1, Math.floor(indicesPerBar));
                    for (let j = 0; j < step; j++) {
                        const index = freqIndex + j;
                        if (index < bufferLength) {
                            sum += dataArray[index];
                            count++;
                        }
                    }

                    const value = count > 0 ? sum / count : 0;

                    // Apply scaling
                    const normalizedValue = Math.pow(value / 255, 0.8);

                    // Symmetrical width calculation
                    const maxWidth = width * 0.9;
                    const minWidth = 4;
                    const barTotalWidth = minWidth + (normalizedValue * (maxWidth - minWidth));

                    const y = i * (barHeight + gap) + gap / 2;
                    const x = centerX - (barTotalWidth / 2);

                    const hue = 250 + (normalizedValue) * 80; // Color based on intensity
                    const alpha = 0.8 + normalizedValue * 0.2;

                    const gradient = ctx.createLinearGradient(centerX - maxWidth / 2, y, centerX + maxWidth / 2, y);

                    if (hasDarkClass) {
                        // Dark Mode: White/Bright bars (Original)
                        gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.3)`);
                        gradient.addColorStop(0.4, `hsla(${hue}, 90%, 95%, ${alpha})`);
                        gradient.addColorStop(0.6, `hsla(${hue}, 90%, 95%, ${alpha})`);
                        gradient.addColorStop(1, `hsla(${hue + 40}, 80%, 70%, 0.3)`);
                    } else {
                        // Light Mode: Black/Dark bars
                        gradient.addColorStop(0, `hsla(0, 0%, 20%, 0.3)`);
                        gradient.addColorStop(0.4, `hsla(0, 0%, 0%, ${alpha})`);
                        gradient.addColorStop(0.6, `hsla(0, 0%, 0%, ${alpha})`);
                        gradient.addColorStop(1, `hsla(0, 0%, 20%, 0.3)`);
                    }

                    ctx.fillStyle = gradient;

                    // Draw rounded pill shape
                    ctx.beginPath();
                    const radius = Math.min(barHeight / 2, 4);

                    // Left rounded edge
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + barTotalWidth - radius, y);
                    ctx.quadraticCurveTo(x + barTotalWidth, y, x + barTotalWidth, y + radius);
                    ctx.lineTo(x + barTotalWidth, y + barHeight - radius);
                    ctx.quadraticCurveTo(x + barTotalWidth, y + barHeight, x + barTotalWidth - radius, y + barHeight);

                    // Right rounded edge (backwards)
                    ctx.lineTo(x + radius, y + barHeight);
                    ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);

                    ctx.closePath();
                    ctx.fill();
                }
            }
            // NOTE: Removed shadowBlur glow effect - it's very GPU intensive
            // and can cause performance issues/black screen after extended use
        };

        requestAnimationFrame(draw);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- FRAME_INTERVAL is a constant derived from FPS_LIMIT
    }, [barCount, orientation]);

    const startAudioCapture = useCallback(async () => {
        try {
            setError(null);


            // Use getDisplayMedia - the main process will auto-select the screen
            // This is the proper way to get system audio in Electron
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: {
                    width: 1,
                    height: 1,
                    frameRate: 1
                }
            });

            if (!isMountedRef.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            // Stop video track - we only need audio
            stream.getVideoTracks().forEach(track => track.stop());

            const audioTracks = stream.getAudioTracks();


            if (audioTracks.length === 0) {
                setError('No audio captured - make sure audio is playing');
                return;
            }

            // Create audio context and analyser
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512; // 256 frequency bins - enough for our bar count
            analyser.smoothingTimeConstant = 0.5; // Less smoothing = more reactive
            analyser.minDecibels = -85;
            analyser.maxDecibels = -10;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            mediaStreamRef.current = stream;


            setIsListening(true);

            // Start visualization
            visualize();
        } catch (err) {
            console.error('Audio capture error:', err);
            setError(`Failed to capture: ${err instanceof Error ? err.message : err}`);
        }
    }, [visualize]);

    const stopAudioCapture = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = undefined;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        analyserRef.current = null;
        // Only update state if component is still mounted
        if (isMountedRef.current) {
            setIsListening(false);
        }
    }, []);

    // Track component mount/unmount and cleanup ALL resources on unmount
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            // CRITICAL: Always cleanup on unmount to prevent memory/GPU leaks
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = undefined;
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            analyserRef.current = null;
        };
    }, []);

    // Auto-start audio capture when isActive changes
    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (isActive) {
            // Small delay to ensure Electron is ready
            timer = setTimeout(() => {
                if (isMountedRef.current) {
                    startAudioCapture();
                }
            }, 300);
        }

        return () => {
            clearTimeout(timer);
            stopAudioCapture();
        };
    }, [isActive, startAudioCapture, stopAudioCapture]);

    // Pause/resume rAF loop based on window focus
    useEffect(() => {
        if (!isWindowFocused && animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = undefined;
        } else if (isWindowFocused && isListening && analyserRef.current) {
            // Resume visualization when window regains focus
            visualize();
        }
    }, [isWindowFocused, isListening, visualize]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                const dpr = window.devicePixelRatio || 1;
                const rect = parent.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(dpr, dpr);
                }
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    if (!isActive) return null;

    return (
        <div className={`relative w-full ${className}`}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative w-full h-full"
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                />

                {/* Status indicator */}
                {error && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-destructive/80 bg-background/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-destructive/20">
                        {error}
                    </div>
                )}

                {!isListening && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-muted-foreground/60 bg-background/40 px-4 py-2 rounded-full backdrop-blur-sm">
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-primary"
                            />
                            <span className="text-sm font-medium">Connecting to system audio...</span>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
