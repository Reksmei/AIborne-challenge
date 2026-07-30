/**
 * Game audio — all sounds synthesized via Web Audio API.
 * - Engine/wind loop that pitches up with speed
 * - Collect chime on target hit
 */

let ctx = null;
let engineGain = null;
let engineOsc = null;
let windNode = null;
let windGain = null;
let masterGain = null;
let started = false;

/**
 * Initialise the audio context. Must be called from a user gesture.
 */
export function init() {
    if (ctx) return;
    ctx = new AudioContext();

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);

    // Engine drone — low-frequency oscillator
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 65;

    // Shape the engine sound
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 200;
    engineFilter.Q.value = 2;

    engineGain = ctx.createGain();
    engineGain.gain.value = 0.12;

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);

    // Wind noise — white noise through bandpass
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    windNode = ctx.createBufferSource();
    windNode.buffer = noiseBuffer;
    windNode.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;

    windGain = ctx.createGain();
    windGain.gain.value = 0.06;

    windNode.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);

    engineOsc.start();
    windNode.start();
    started = true;
}

/**
 * Update engine/wind pitch and volume based on speed.
 * Call this every frame.
 * @param {number} speed — current aircraft speed
 * @param {number} baseSpeed — the default cruise speed
 * @param {number} boostSpeed — the max boost speed
 */
export function updateEngine(speed, baseSpeed, boostSpeed) {
    if (!started) return;

    const t = (speed - 30) / (boostSpeed - 30); // 0 at brake, 1 at boost
    const clamped = Math.max(0, Math.min(1, t));

    // Engine pitch rises with speed
    engineOsc.frequency.value = 55 + clamped * 60;
    engineGain.gain.value = 0.08 + clamped * 0.1;

    // Wind gets louder and higher with speed
    windGain.gain.value = 0.03 + clamped * 0.12;
}

/**
 * Play a short chime when a target is collected.
 * Pitch varies with points scored for feedback.
 * @param {number} points — score value of the collected target
 */
export function playCollect(points) {
    if (!ctx) return;

    // Higher points = higher pitch chime
    const basePitch = 600 + Math.min(points, 1500) * 0.4;

    // Two-tone chime
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = basePitch;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = basePitch * 1.5; // perfect fifth above

    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.05);
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
}
