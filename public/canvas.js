/**
 * Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
 * CANVAS RENDERER Ã¢â‚¬â€ js/canvas.js  (Spribe-accurate)
 * Dark navy background, subtle grid, flight curve, plane
 * (body + propeller SVGs), multiplier text, crash effects.
 * Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
 */

class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        /* SVG image assets */
        this.planeBodyImage = new Image();
        this.planeBodyLoaded = false;
        this.planeBodyImage.onload = () => { this.planeBodyLoaded = true; };
        this.planeBodyImage.src = 'plane_body.svg';

        this.propellerImage = new Image();
        this.propellerLoaded = false;
        this.propellerImage.onload = () => { this.propellerLoaded = true; };
        this.propellerImage.src = 'propeller.svg';
        this.propellerRotation = 0;
        this.crashFlashOpacity = 0;
        this.lastPlanePos = null;

        /** @type {number} Animated offset for diagonal stripes */
        this._stripeOffset = 0;

        this._resizeCanvas();
        console.log('CanvasRenderer initialized |', this.canvas.width, 'Ãƒâ€”', this.canvas.height);
    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â SIZING Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    _resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // When the container is off-screen or hidden (left:-10000px, visibility:hidden, etc.)
        // getBoundingClientRect() returns 0x0. Fall back to viewport size so the canvas
        // is always initialised with real dimensions, avoiding a blank 0x0 canvas.
        const w = rect.width  > 0 ? rect.width  : window.innerWidth;
        const h = rect.height > 0 ? rect.height : window.innerHeight;

        this.canvas.width  = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.scale(dpr, dpr);
        this.displayWidth  = w;
        this.displayHeight = h;
    }

    handleResize() { this._resizeCanvas(); }

    /** Convenience alias â€” called by the Interbet shell after making the game view visible. */
    forceResize() { this._resizeCanvas(); }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â BACKGROUND LAYER Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    /**
     * Draw the Spribe-accurate background:
     *   - Dark fill with subtle radial vignette
     *   - Faint diagonal stripe texture
     *   - Y-axis multiplier labels (1, 2, 3, ... up to viewMax)
     *   - Horizontal dashed grid lines at each multiplier level
     * @param {number} [currentMultiplier=1] - current multiplier for dynamic scaling
     */
    _drawBackground(currentMultiplier = 1) {
        const { ctx } = this;
        const w = this.displayWidth;
        const h = this.displayHeight;

        // Ã¢â€â‚¬Ã¢â€â‚¬ Base fill (very dark with slight green-teal tint) Ã¢â€â‚¬Ã¢â€â‚¬
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        // Ã¢â€â‚¬Ã¢â€â‚¬ Radial vignette (lighter center, darker edges) Ã¢â€â‚¬Ã¢â€â‚¬
        const vignette = ctx.createRadialGradient(
            w * 0.5, h * 0.45, w * 0.1,
            w * 0.5, h * 0.45, w * 0.75
        );
        vignette.addColorStop(0, 'rgba(20, 35, 45, 0.4)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        // -- Bold alternating ray bands from bottom-left (Spribe-accurate) --
        this._stripeOffset = this._stripeOffset + 0.012;
        const rayOx = 0;
        const rayOy = h;
        const rayLen = Math.sqrt(w * w + h * h) * 1.5;
        const totalRays = 60;  // Full 360 circle for endless loop
        const fullSpread = Math.PI * 2; // Full spread (2*PI)
        const bandWidth = fullSpread / totalRays;
        const darkA = "rgba(26, 45, 63, 0.28)";  // Slightly lighter dark shade
        const darkB = "rgba(15, 26, 37, 0.20)";  // Slightly darker shade (close to base)

        ctx.save();
        ctx.translate(rayOx, rayOy);
        // Very slow continuous rotation
        const rotOffset = this._stripeOffset * 0.05;
        ctx.rotate(rotOffset);

        for (let i = 0; i < totalRays; i++) {
            const a = -Math.PI / 2 + i * bandWidth;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, rayLen, a, a + bandWidth);
            ctx.closePath();
            ctx.fillStyle = (i % 2 === 0) ? darkA : darkB;
            ctx.fill();
        }
        ctx.restore();

        // Ã¢â€â‚¬Ã¢â€â‚¬ Dynamic Y-axis grid: multiplier labels + dashed horizontals Ã¢â€â‚¬Ã¢â€â‚¬
        const viewMax = Math.max(2.5, currentMultiplier * 1.35);

        // Decide which multiplier tick values to show
        const ticks = [];
        let step = 1;
        if (viewMax > 20) step = 5;
        else if (viewMax > 10) step = 2;
        for (let m = step; m < viewMax; m += step) {
            ticks.push(m);
        }

        // Padding (must match _toCanvas)
        const padL = w * 0.06;
        const padR = w * 0.12;
        const padB = h * 0.10;
        const padT = h * 0.15;

        ctx.save();

        for (const tickM of ticks) {
            // Use the same math as _curvePoint Y-axis
            const t = (tickM) / (viewMax - 1);
            const ny = Math.pow(t, 1.6);
            const pixelY = (h - padB) - ny * (h - padB - padT);

            // Skip if out of visible area
            if (pixelY < padT * 0.5 || pixelY > h - padB + 5) continue;

            // Ã¢â€â‚¬Ã¢â€â‚¬ Dashed horizontal line Ã¢â€â‚¬Ã¢â€â‚¬
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.lineWidth = 0.5;
            ctx.moveTo(padL, pixelY);
            ctx.lineTo(w - padR, pixelY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Ã¢â€â‚¬Ã¢â€â‚¬ Y-axis label Ã¢â€â‚¬Ã¢â€â‚¬
            ctx.font = '500 11px Inter, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(tickM + '', padL - 8, pixelY);
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Subtle axis lines (left edge and bottom edge) Ã¢â€â‚¬Ã¢â€â‚¬
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([]);
        // Left axis
        ctx.beginPath();
        ctx.moveTo(padL, padT * 0.5);
        ctx.lineTo(padL, h - padB);
        ctx.stroke();
        // Bottom axis
        ctx.beginPath();
        ctx.moveTo(padL, h - padB);
        ctx.lineTo(w - padR, h - padB);
        ctx.stroke();

        ctx.restore();
    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â SPRIBE CURVE MATHS Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
    /*
     * Spribe Aviator curve behavior:
     *   - Starts at bottom-left, curves upward in an exponential "C" shape
     *   - X moves steadily rightward (time-based)
     *   - Y rises slowly at first, then accelerates upward
     *   - At high multipliers the "viewport" zooms out so the plane
     *     shrinks but never leaves the canvas
     *   - The red filled trail follows exactly from the plane's tail
     */

    /**
     * Map a multiplier value to a normalized curve point (0-1 range).
     * Uses logarithmic X and power Y for the characteristic C-shape.
     * @param {number} m - multiplier (>= 1.00)
     * @param {number} maxM - current max multiplier (for dynamic viewport)
     * @returns {{nx: number, ny: number}} normalized coords
     */
    _curvePoint(m, maxM) {
        // Dynamic viewport: grows with multiplier so plane stays visible
        // Extra padding (1.35x) ensures the plane never reaches the canvas edge
        const viewMax = Math.max(2.5, maxM * 1.35);

        // X: logarithmic spread Ã¢â‚¬â€ moves fast early, slows down
        const nx = Math.log(m) / Math.log(viewMax);

        // Y: power curve Ã¢â‚¬â€ slow rise then steep climb (the "C" shape)
        const t = (m - 1) / Math.max(1, viewMax - 1);
        const ny = Math.pow(t, 1.6);

        // Clamp to keep everything within visible bounds
        return { nx: Math.min(nx, 0.92), ny: Math.min(ny, 0.92) };
    }

    /**
     * Convert normalized curve point to canvas pixel coordinates.
     * Origin is bottom-left with padding.
     */
    _toCanvas(nx, ny, cw, ch) {
        const padL = cw * 0.06;   // left padding
        const padR = cw * 0.12;   // right padding (room for plane)
        const padB = ch * 0.10;   // bottom padding
        const padT = ch * 0.15;   // top padding

        const x = padL + nx * (cw - padL - padR);
        const y = (ch - padB) - ny * (ch - padB - padT);
        return { x, y };
    }

    /**
     * Calculate the plane position and rotation for a given multiplier.
     */
    calculatePlanePosition(multiplier, cw, ch) {
        const pt = this._curvePoint(multiplier, multiplier);
        const pos = this._toCanvas(pt.nx, pt.ny, cw, ch);

        // Calculate tangent angle by sampling a tiny step ahead
        const dm = 0.01;
        const ptA = this._curvePoint(multiplier, multiplier);
        const ptB = this._curvePoint(multiplier + dm, multiplier + dm);
        const pxA = this._toCanvas(ptA.nx, ptA.ny, cw, ch);
        const pxB = this._toCanvas(ptB.nx, ptB.ny, cw, ch);

        const dx = pxB.x - pxA.x;
        const dy = pxB.y - pxA.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        // Clamp rotation: plane stays between -60 (steep climb) and 15 (slight descent)
        angle = Math.max(-60, Math.min(15, angle));

        // Dynamic scale: plane shrinks but stays clearly visible
        // At 1x = full size, at 10x Ã¢â€°Ë† 0.65, at 100x Ã¢â€°Ë† 0.4, never below 0.35
        const scale = Math.max(0.35, 1.0 / (1 + Math.log(multiplier) * 0.3));

        return { x: pos.x, y: pos.y, rotation: angle, scale };
    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â FLIGHT CURVE DRAWING Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    _drawFlightCurve(multiplier, planePos = null) {
        const { ctx } = this;
        const cw = this.displayWidth;
        const ch = this.displayHeight;

        // Origin point
        const origin = this._toCanvas(0, 0, cw, ch);

        // Build curve path with many sample points
        const steps = Math.max(80, Math.floor(multiplier * 20));
        const points = [];
        for (let i = 0; i <= steps; i++) {
            const m = 1.0 + (multiplier - 1.0) * (i / steps);
            const pt = this._curvePoint(m, multiplier);
            const px = this._toCanvas(pt.nx, pt.ny, cw, ch);
            points.push(px);
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Filled area under curve Ã¢â€â‚¬Ã¢â€â‚¬
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        for (const p of points) {
            ctx.lineTo(p.x, p.y);
        }
        // Close to bottom-right then bottom-left
        const last = points[points.length - 1];
        ctx.lineTo(last.x, ch);
        ctx.lineTo(origin.x, ch);
        ctx.closePath();

        // Gradient fill (vivid at curve, fading to transparent at bottom)
        const grad = ctx.createLinearGradient(0, last.y, 0, ch);
        grad.addColorStop(0, 'rgba(229, 5, 57, 0.45)');
        grad.addColorStop(0.6, 'rgba(229, 5, 57, 0.12)');
        grad.addColorStop(1, 'rgba(229, 5, 57, 0.02)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Ã¢â€â‚¬Ã¢â€â‚¬ Curve stroke (red line) Ã¢â€â‚¬Ã¢â€â‚¬
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        for (const p of points) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = '#e50539';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Ã¢â€â‚¬Ã¢â€â‚¬ Glow effect on the curve line Ã¢â€â‚¬Ã¢â€â‚¬
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        for (const p of points) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(229, 5, 57, 0.3)';
        ctx.lineWidth = 8;
        ctx.stroke();
    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â PLANE DRAWING Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    drawPlane(x, y, rotation, scale = 1.0) {
        const { ctx } = this;
        // New SVG viewBox: 479x297 (ratio ~1.61:1)
        const planeWidth = 130 * scale;
        const planeHeight = (planeWidth * 297) / 479;  // Maintain aspect ratio

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);

        // Glow behind plane
        ctx.shadowColor = 'rgba(229,5,57,0.6)';
        ctx.shadowBlur = 25 * scale;

        if (this.planeBodyLoaded) {
            // Center the plane body on (0,0)
            ctx.drawImage(this.planeBodyImage,
                -planeWidth * 0.45, -planeHeight / 2,
                planeWidth, planeHeight);
        }

        if (this.propellerLoaded) {
            // Propeller pivot point (approx center of mass in 479x297 image)
            const pivotX = 428;
            const pivotY = 127;

            // Calculate scale factors
            const scaleX = planeWidth / 479;
            const scaleY = planeHeight / 297;

            // Calculate pivot offset relative to context center (0,0)
            // Context center corresponds to image coord (479*0.45, 297*0.5)
            const dx = (pivotX * scaleX) - (planeWidth * 0.45);
            const dy = (pivotY * scaleY) - (planeHeight * 0.5);

            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate((this.propellerRotation * Math.PI) / 180);

            // Scale down propeller relative to plane (maintaining pivot as center)
            const propRelScale = 0.7;
            ctx.scale(propRelScale, propRelScale);

            // Draw image offset by pivot
            ctx.drawImage(this.propellerImage, -pivotX * scaleX, -pivotY * scaleY, planeWidth, planeHeight);
            ctx.restore();

            // Spin animation (gentle rotation)
            this.propellerRotation = (this.propellerRotation + 12) % 360;
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;



        ctx.restore();

    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â TEXT OVERLAYS Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    _drawMultiplierText(text, { fontSize = 64, scale = 1, color = '#ffffff' } = {}) {
        const { ctx } = this;
        const cx = this.displayWidth / 2;
        const cy = this.displayHeight * 0.40;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        ctx.font = `900 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(229,5,57,0.6)';
        ctx.shadowBlur = 20;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    _drawFlewAwayText(opacity) {
        if (opacity <= 0) return;
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = '700 18px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#e50539';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FLEW AWAY!', this.displayWidth / 2, this.displayHeight * 0.40 + 35);
        ctx.restore();
    }

    _drawCountdown(seconds) {
        const { ctx } = this;
        ctx.save();
        ctx.font = '600 32px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Starting in ${seconds}...`, this.displayWidth / 2, this.displayHeight / 2);
        ctx.restore();
    }

    _drawCrashFlash() {
        if (this.crashFlashOpacity <= 0) return;
        const { ctx } = this;
        ctx.save();
        ctx.fillStyle = `rgba(229,5,57,${this.crashFlashOpacity})`;
        ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
        ctx.restore();
    }

    /* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â MAIN RENDER ENTRY POINTS Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */

    renderWaiting(countdown, flewAwayOpacity = 0, lastCrashMultiplier = null) {
        this._drawBackground();

        // Draw plane waiting on runway (at 1.00x position)
        const pos = this.calculatePlanePosition(1.0, this.displayWidth, this.displayHeight);
        pos.rotation = 0; // Flat

        const planeWidth = 130 * pos.scale;
        const planeHeight = (planeWidth * 297) / 479;
        const contactX = -planeWidth * 0.2;
        const contactY = planeHeight * 0.42;

        const drawX = pos.x - contactX;
        const drawY = pos.y - contactY;

        this.drawPlane(drawX, drawY, pos.rotation, pos.scale);

        if (flewAwayOpacity > 0 && lastCrashMultiplier !== null) {
            this._drawMultiplierText(lastCrashMultiplier.toFixed(2) + 'x', { fontSize: 48, color: '#e50539' });
            this._drawFlewAwayText(flewAwayOpacity);
        }
    }

    renderFlying(multiplier) {
        this._drawBackground(multiplier);

        const pos = this.calculatePlanePosition(multiplier, this.displayWidth, this.displayHeight);
        this.lastPlanePos = pos;

        // 1. Draw flight curve ending exactly at 'pos'
        this._drawFlightCurve(multiplier, pos);

        // 2. Draw plane such that its "belly contact point" is at 'pos'
        const planeWidth = 130 * pos.scale;
        const planeHeight = (planeWidth * 297) / 479;

        // Force rotation to 0 (flying straight right) per user request
        pos.rotation = 0;

        // Vector from Plane Center to Contact Point (rear belly)
        // Move contact point back to the tail area (-0.2w)
        // Move contact point UP slightly (0.42h instead of 0.5h) to make plane overlap line
        const contactX = -planeWidth * 0.2;
        const contactY = planeHeight * 0.42;

        // Rotate this vector (trivial if rotation is 0, but keeping logic generic)
        const rad = (pos.rotation * Math.PI) / 180;
        const rotatedContactX = contactX * Math.cos(rad) - contactY * Math.sin(rad);
        const rotatedContactY = contactX * Math.sin(rad) + contactY * Math.cos(rad);

        // Plane position = Curve End - Rotated Contact Vector
        // This ensures the contact point lands exactly on 'pos'
        const drawX = pos.x - rotatedContactX;
        const drawY = pos.y - rotatedContactY;

        this.drawPlane(drawX, drawY, pos.rotation, pos.scale);
        this._drawMultiplierText(multiplier.toFixed(2) + 'x', { fontSize: 48 });
    }

    renderCrashed(crashMultiplier, animProgress) {
        this._drawBackground(crashMultiplier);
        this._drawFlightCurve(crashMultiplier);

        if (this.lastPlanePos && animProgress < 1) {
            const offX = this.lastPlanePos.x + animProgress * this.displayWidth * 0.5;
            const offY = this.lastPlanePos.y - animProgress * this.displayHeight * 0.6;
            const offRot = this.lastPlanePos.rotation - animProgress * 15;
            const offScale = 1.0 + animProgress * 0.3;
            this.drawPlane(offX, offY, offRot, offScale);
        }

        this.crashFlashOpacity = animProgress < 0.25 ? 0.1 * (1 - animProgress / 0.25) : 0;
        this._drawCrashFlash();

        const textScale = 1.0 + Math.min(animProgress, 0.3) * 0.33;
        this._drawMultiplierText(crashMultiplier.toFixed(2) + 'x', { fontSize: 48, color: '#e50539', scale: textScale });
        this._drawFlewAwayText(Math.min(animProgress / 0.3, 1));
    }

    renderCooldown(crashMultiplier, fadeProgress) {
        this._drawBackground(crashMultiplier);
        const opacity = 1 - fadeProgress;
        if (opacity > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = opacity;
            this._drawFlightCurve(crashMultiplier);
            this._drawMultiplierText(crashMultiplier.toFixed(2) + 'x', { fontSize: 48, color: '#e50539' });
            this._drawFlewAwayText(opacity);
            this.ctx.restore();
        }
    }
}