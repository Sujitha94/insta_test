import { useEffect } from 'react';

export default function ViewportFix() {
    useEffect(() => {

        // Prevent iPhone input zoom
        const meta = document.querySelector('meta[name=viewport]');
        if (meta) {
            meta.setAttribute(
                'content',
                'width=device-width, initial-scale=1, maximum-scale=1'
            );
        }

        // Prevent pinch zoom (iOS)
        const handleGestureStart = (e: Event) => e.preventDefault();
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 1) e.preventDefault();
        };

        // Dynamic viewport height fix
        const setVh = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);

        document.addEventListener('gesturestart', handleGestureStart, { passive: false });
        document.addEventListener('gesturechange', handleGestureStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            document.removeEventListener('gesturestart', handleGestureStart);
            document.removeEventListener('gesturechange', handleGestureStart);
            document.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('resize', setVh);
            window.removeEventListener('orientationchange', setVh);
        };
    }, []);

    return null;
}
