/**
 * Radio effect audio processor.
 * Intercepts the AudioContext created by the Firebase SDK
 * and inserts a filter chain that makes audio sound like
 * a muffled cockpit radio (bandpass filter + light distortion + noise).
 *
 * Must be called BEFORE startAudioConversation() so the
 * AudioContext constructor patch is in place.
 */

let radioCtx = null;
let filterChain = null;

/**
 * Install the AudioContext interceptor.
 * Call this once before Gemini audio starts.
 */
export function install() {
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;

    // Patch the constructor so when the SDK creates an AudioContext,
    // we get a reference and can insert our filter chain.
    const PatchedAudioContext = function (...args) {
        const ctx = new OriginalAudioContext(...args);

        // Only patch once (the first AudioContext the SDK creates)
        if (!radioCtx) {
            radioCtx = ctx;
            patchDestination(ctx);
        }

        return ctx;
    };

    // Copy static properties
    PatchedAudioContext.prototype = OriginalAudioContext.prototype;
    window.AudioContext = PatchedAudioContext;
    if (window.webkitAudioContext) {
        window.webkitAudioContext = PatchedAudioContext;
    }
}

/**
 * Intercept ctx.destination so any node connected to it
 * goes through our radio filter chain first.
 */
function patchDestination(ctx) {
    // Build the filter chain
    filterChain = buildRadioChain(ctx);

    // Connect our chain output to the real destination
    filterChain.output.connect(ctx.destination);

    // Override the destination getter so the SDK connects to our chain input
    const realDestination = ctx.destination;
    Object.defineProperty(ctx, 'destination', {
        get() {
            return filterChain.input;
        },
    });

    // Keep a reference to real destination for bypass if needed
    ctx._realDestination = realDestination;
}

/**
 * Build the radio effect filter chain:
 * 1. High-pass at 300Hz (remove low rumble)
 * 2. Low-pass at 3500Hz (remove high frequencies — muffled)
 * 3. Peaking EQ at 1200Hz (boost mids — tinny radio character)
 * 4. Compressor (squash dynamics like a radio AGC)
 * 5. Subtle waveshaper (light crackle/distortion)
 * 6. Gain (slight volume reduction)
 */
function buildRadioChain(ctx) {
    // High-pass filter — cuts below 300Hz
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 200;
    highpass.Q.value = 0.5;

    // Low-pass filter — cuts above 5000Hz (gentler rolloff)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 5000;
    lowpass.Q.value = 0.5;

    // Peaking EQ — mild mid boost for radio character
    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 1200;
    midBoost.Q.value = 1.0;
    midBoost.gain.value = 3;

    // Compressor — gentle AGC
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 15;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    // Output gain — clean audio level
    const gain = ctx.createGain();
    gain.gain.value = 1.0;

    // Wire clean chain (compressor -> gain -> output)
    highpass.connect(lowpass);
    lowpass.connect(midBoost);
    midBoost.connect(compressor);
    compressor.connect(gain);

    return {
        input: highpass,   // SDK connects to this
        output: gain,      // This connects to real destination
    };
}

/**
 * Generate a soft-clip distortion curve.
 */
function makeDistortionCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}
