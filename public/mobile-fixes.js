// Mobile Fixes for Aviator Game
// Handles iOS Safari viewport height, touch interactions, and orientation changes

// Fix for iOS Safari viewport height changes
function setViewportHeight() {
    // Get actual viewport height
    const vh = window.innerHeight * 0.01;
    // Set CSS custom property
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Set on load
setViewportHeight();

// Update on resize (address bar show/hide)
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setViewportHeight, 100);
});

// Update on orientation change
window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 200);
});

// Prevent pull-to-refresh on iOS but allow scrolling in content areas
document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('.betting-panels') || e.target.closest('.history-container') || e.target.closest('.app-body')) {
        // Allow scrolling in betting panels, history, and main body
        return;
    }
    // Prevent body scroll bounce/pull-to-refresh elsewhere
    e.preventDefault();
}, { passive: false });

console.log('[Mobile] Viewport fixes initialized');