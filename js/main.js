import { initScene, setWeather } from './scene-setup.js';
import { createAircraft, updateAircraft } from './aircraft.js';
import { initCamera, updateCamera } from './camera-controller.js';
import { createTerrain, updateClouds } from './terrain.js';
import { createTargets, updateTargets, highlightTargets, clearHighlights, spawnTargets } from './targets.js';
import { setScale as setAircraftScale, setColour as setAircraftColour, setSpeedMultiplier, doBarrelRoll, setInvertedControls, resetPosition, transformModel } from './aircraft.js';
import { initHUD } from './hud.js';
import { startGame, updateGameState, addPoints, isRunning } from './game-state.js';
import * as ScoringRules from './scoring-rules.js';
import * as gemini from './gemini-session.js';
import { install as installRadioEffect } from './radio-effect.js';
import * as Audio from './audio.js';
import { CONFIG } from './config.js';
import * as Mic from './mic-control.js';
import * as Autopilot from './autopilot.js';
import * as Leaderboard from './leaderboard.js';
import { showMessage } from './hud.js';

// Generate randomized scoring rules
ScoringRules.generate();

// Init HUD
initHUD();

// Gemini prompt is generated at start time with the callsign
let geminiPrompt = '';

// Gemini modal elements
const geminiDot = document.getElementById('gemini-modal-dot');
const geminiLabel = document.getElementById('gemini-modal-label');
const geminiTranscript = document.getElementById('gemini-transcript');

// Streaming transcript state — fragments arrive incrementally
let currentOutputLine = null;
let currentInputLine = null;

function handleGeminiStatus(status) {
    // Update dot indicator
    geminiDot.className = '';
    if (status === 'connecting') {
        geminiDot.classList.add('connecting');
        geminiLabel.textContent = 'GEMINI — connecting...';
    } else if (status === 'connected') {
        geminiDot.classList.add('connected');
        geminiLabel.textContent = 'GEMINI — listening';
    } else if (status === 'error') {
        geminiDot.classList.add('error');
        geminiLabel.textContent = 'GEMINI — error';
    } else {
        geminiLabel.textContent = 'GEMINI — disconnected';
    }
}

function handleTranscriptFragment(direction, text) {
    if (direction === 'output') {
        // Finalize any user line
        currentInputLine = null;
        // Create new model line if needed
        if (!currentOutputLine) {
            currentOutputLine = createTranscriptLine('model');
        }
        appendToLine(currentOutputLine, text);
    } else if (direction === 'input') {
        // Finalize any model line
        currentOutputLine = null;
        // Create new user line if needed
        if (!currentInputLine) {
            currentInputLine = createTranscriptLine('user');
        }
        appendToLine(currentInputLine, text);
    }
}

function createTranscriptLine(role) {
    const line = document.createElement('div');
    line.className = `transcript-line ${role}`;

    const roleSpan = document.createElement('span');
    roleSpan.className = 'role';
    roleSpan.textContent = role === 'model' ? 'gemini' : 'you';
    line.appendChild(roleSpan);

    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    line.appendChild(textSpan);

    geminiTranscript.appendChild(line);
    return line;
}

function appendToLine(lineEl, text) {
    const textSpan = lineEl.querySelector('.text');
    if (textSpan) textSpan.textContent += text;
    geminiTranscript.scrollTop = geminiTranscript.scrollHeight;
}

// Tool declarations for Gemini
const toolDeclarations = [
    // --- Core tools ---
    {
        name: 'highlight_targets',
        description: 'Highlight specific targets in the game world with vertical beacons so the player can spot them. Any combination of filters can be used. Returns count of matches.',
        parameters: {
            type: 'object',
            properties: {
                shape:    { type: 'string', enum: ['ring', 'square', 'triangle', 'hexagon'], description: 'Filter by shape.' },
                colour:   { type: 'string', enum: ['blue', 'red', 'yellow', 'green'], description: 'Filter by colour.' },
                size:     { type: 'string', enum: ['small', 'medium', 'large'], description: 'Filter by size.' },
                duration: { type: 'number', description: 'Highlight duration in seconds. Default 8.' },
            },
        },
    },
    {
        name: 'clear_highlights',
        description: 'Remove all active target highlights.',
        parameters: { type: 'object', properties: {} },
    },

    // --- Easter egg tools ---
    {
        name: 'spawn_targets',
        description: 'Spawn extra targets into the game world. Can specify shape, colour, size, and count. Targets appear near the player.',
        parameters: {
            type: 'object',
            properties: {
                shape:  { type: 'string', enum: ['ring', 'square', 'triangle', 'hexagon'], description: 'Shape of spawned targets. Random if omitted.' },
                colour: { type: 'string', enum: ['blue', 'red', 'yellow', 'green'], description: 'Colour of spawned targets. Random if omitted.' },
                size:   { type: 'string', enum: ['small', 'medium', 'large'], description: 'Size of spawned targets. Random if omitted.' },
                count:  { type: 'number', description: 'Number of targets to spawn. Default 10. Max 10000. Go absolutely wild.' },
            },
        },
    },
    {
        name: 'set_plane_speed',
        description: 'Change the speed of the aircraft by setting a multiplier. 1 is normal, 2 is double speed, 0.5 is half speed. Use for fun effects like ludicrous speed or slow motion.',
        parameters: {
            type: 'object',
            properties: {
                multiplier: { type: 'number', description: 'Speed multiplier. 1 = normal, 0.1-5 range.' },
            },
            required: ['multiplier'],
        },
    },
    {
        name: 'set_plane_size',
        description: 'Change the size of the aircraft. 1 is normal. Make it tiny or enormous for comedic effect.',
        parameters: {
            type: 'object',
            properties: {
                scale: { type: 'number', description: 'Scale factor. 1 = normal, 0.1 = tiny, 5 = huge, 20 = absurd, 50 = kaiju mode.' },
            },
            required: ['scale'],
        },
    },
    {
        name: 'set_plane_colour',
        description: 'Change the colour of the entire aircraft. Use any hex colour or a named colour.',
        parameters: {
            type: 'object',
            properties: {
                colour: { type: 'string', description: 'Colour as hex string e.g. "#ff0000" for red, "#00ff00" for green, "#ff69b4" for hot pink, "#ffd700" for gold.' },
            },
            required: ['colour'],
        },
    },
    {
        name: 'do_barrel_roll',
        description: 'Make the aircraft do a barrel roll! A full 360-degree spin. Use when the player is excited or asks for a trick.',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'invert_controls',
        description: 'Invert the pitch controls so up is down and down is up. Toggle on or off. Use as a prank or challenge.',
        parameters: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean', description: 'True to invert, false to restore normal.' },
            },
            required: ['enabled'],
        },
    },
    {
        name: 'add_bonus_time',
        description: 'Add extra seconds to the game timer. Use as a reward for good play or when the player asks nicely.',
        parameters: {
            type: 'object',
            properties: {
                seconds: { type: 'number', description: 'Seconds to add. Can be 5-30.' },
            },
            required: ['seconds'],
        },
    },
    {
        name: 'reset_position',
        description: 'Teleport the aircraft back to the starting point in the centre of the map. Resets heading and speed. Useful if the player is lost or asks to go back.',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'transform_vehicle',
        description: 'Transform the aircraft into a completely different vehicle or creature. Use for fun when the player asks to change their ride.',
        parameters: {
            type: 'object',
            properties: {
                shape: {
                    type: 'string',
                    enum: ['plane', 'rocket', 'ufo', 'bird', 'dragon', 'helicopter', 'paper_plane'],
                    description: 'The vehicle/creature to transform into. "plane" restores the default.',
                },
            },
            required: ['shape'],
        },
    },
    {
        name: 'set_weather',
        description: 'Change the weather and atmosphere. Dramatically alters the sky, fog, and lighting.',
        parameters: {
            type: 'object',
            properties: {
                preset: {
                    type: 'string',
                    enum: ['sunny', 'sunset', 'night', 'stormy', 'foggy', 'alien'],
                    description: 'Weather preset. sunny=clear blue sky, sunset=orange golden hour, night=dark with moonlight, stormy=dark grey overcast, foggy=thick white fog, alien=purple sci-fi atmosphere.',
                },
            },
            required: ['preset'],
        },
    },
];

// Colour name to hex mapping for convenience
const COLOUR_MAP = {
    red: 0xEA4335, blue: 0x4285F4, green: 0x34A853, yellow: 0xFBBC04,
    white: 0xffffff, black: 0x111111, pink: 0xff69b4, purple: 0x9b59b6,
    orange: 0xff8c00, gold: 0xffd700, cyan: 0x00bcd4, hotpink: 0xff69b4,
    rainbow: 0xff00ff,
};

function parseColour(str) {
    if (!str) return 0xdddddd;
    const lower = str.toLowerCase().replace(/[^a-z0-9#]/g, '');
    if (COLOUR_MAP[lower]) return COLOUR_MAP[lower];
    if (lower.startsWith('#')) return parseInt(lower.slice(1), 16);
    return parseInt(lower, 16) || 0xdddddd;
}

function handleToolCall(functionCall) {
    const { name, args } = functionCall;
    console.log(`[tool] ${name}`, args);

    switch (name) {
        case 'highlight_targets': {
            const count = highlightTargets({
                shape: args.shape || null,
                colour: args.colour || null,
                size: args.size || null,
                duration: args.duration || 8,
            });
            return { success: true, highlighted_count: count };
        }
        case 'clear_highlights': {
            clearHighlights();
            return { success: true };
        }
        case 'spawn_targets': {
            const count = Math.min(args.count || 10, 10000);
            const spawned = spawnTargets({
                shape: args.shape || null,
                colour: args.colour || null,
                size: args.size || null,
                count,
            });
            return { success: true, spawned_count: spawned };
        }
        case 'set_plane_speed': {
            const m = Math.max(0.1, Math.min(20, args.multiplier || 1));
            setSpeedMultiplier(m);
            return { success: true, speed_multiplier: m };
        }
        case 'set_plane_size': {
            const s = Math.max(0.1, Math.min(50, args.scale || 1));
            setAircraftScale(s);
            return { success: true, scale: s };
        }
        case 'set_plane_colour': {
            const hex = parseColour(args.colour);
            setAircraftColour(hex);
            return { success: true, colour: args.colour };
        }
        case 'do_barrel_roll': {
            doBarrelRoll();
            return { success: true, message: 'Barrel roll initiated!' };
        }
        case 'invert_controls': {
            setInvertedControls(!!args.enabled);
            return { success: true, inverted: !!args.enabled };
        }
        case 'add_bonus_time': {
            const secs = Math.max(5, Math.min(30, args.seconds || 10));
            CONFIG.gameDuration += secs;
            return { success: true, added_seconds: secs, new_duration: CONFIG.gameDuration };
        }
        case 'reset_position': {
            resetPosition();
            return { success: true, message: 'Teleported back to start.' };
        }
        case 'transform_vehicle': {
            const result = transformModel(args.shape || 'plane');
            return { success: true, vehicle: result };
        }
        case 'set_weather': {
            const ok = setWeather(args.preset || 'sunny');
            return { success: ok, weather: args.preset };
        }
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// Push-to-talk
const pttBtn = document.getElementById('ptt-btn');

function updatePttUI(muted) {
    if (muted) {
        pttBtn.textContent = 'MIC OFF';
        pttBtn.classList.remove('active');
    } else {
        pttBtn.textContent = 'MIC ON';
        pttBtn.classList.add('active');
    }
}

// Mouse: hold to talk
pttBtn.addEventListener('mousedown', () => { Mic.setMuted(false); });
pttBtn.addEventListener('mouseup', () => { Mic.setMuted(true); });
pttBtn.addEventListener('mouseleave', () => { Mic.setMuted(true); });

// Touch: hold to talk
pttBtn.addEventListener('touchstart', (e) => { e.preventDefault(); Mic.setMuted(false); });
pttBtn.addEventListener('touchend', () => { Mic.setMuted(true); });

// Keyboard: hold T to talk
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat) Mic.setMuted(false);
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyT') Mic.setMuted(true);
});

async function connectGemini() {
    // Install interceptors before SDK creates its AudioContext / mic stream
    installRadioEffect();
    Mic.install(updatePttUI);

    try {
        await gemini.connect({
            systemPrompt: geminiPrompt,
            tools: toolDeclarations,
            onStatusChange: handleGeminiStatus,
            onTranscript: handleTranscriptFragment,
            onToolCall: handleToolCall,
        });
        await gemini.startAudioConversation();
        console.log("[main] Audio conversation started, sending intro text...");

        // Send intro text to kick off the flight assistant greeting
        await gemini.sendText(
            'The game just started and the pilot is now flying. Introduce yourself as their flight assistant, give them a brief exciting rundown of the challenge (collect targets to score points, 2 minutes on the clock, different targets are worth different points), and encourage them to ask you for advice and tips on how to maximise their score. Keep it short and punchy.'
        );
    } catch (err) {
        console.error('Gemini connection failed:', err);
        handleGeminiStatus('error');
        if (!navigator.mediaDevices?.getUserMedia) {
            console.error('[main] getUserMedia unavailable. Access via https:// or http://localhost');
        }
    }
}

// Init 3D scene
const { renderer, scene, camera } = initScene();
initCamera(camera);
createTerrain(scene);
createAircraft(scene);
createTargets(scene);

// ---- Leaderboard UI ----
const lbModal = document.getElementById('leaderboard-modal');
const lbBody = document.getElementById('lb-body');
const lbShowBtn = document.getElementById('lb-show-btn');
const lbCloseBtn = document.getElementById('lb-close-btn');
const callsignInput = document.getElementById('callsign-input');

function renderLeaderboard() {
    const entries = Leaderboard.getEntries();
    if (entries.length === 0) {
        lbBody.innerHTML = '<div class="lb-empty">No scores yet. Be the first pilot!</div>';
        return;
    }
    let html = '<table class="lb-table"><thead><tr><th>#</th><th>CALLSIGN</th><th style="text-align:right">SCORE</th><th style="text-align:right">TIME</th><th style="text-align:right">DATE</th></tr></thead><tbody>';
    entries.forEach((e, i) => {
        const t = e.time || 0;
        const tm = Math.floor(t / 60);
        const ts = t % 60;
        const timeStr = `${tm}:${ts.toString().padStart(2, '0')}`;
        html += `<tr><td class="rank">${i + 1}</td><td>${e.callsign}</td><td class="score">${e.score.toLocaleString()}</td><td class="date">${timeStr}</td><td class="date">${e.date}</td></tr>`;
    });
    html += '</tbody></table>';
    lbBody.innerHTML = html;
}

lbShowBtn.addEventListener('click', () => {
    renderLeaderboard();
    lbModal.classList.add('visible');
});
lbCloseBtn.addEventListener('click', () => {
    lbModal.classList.remove('visible');
});
lbModal.addEventListener('click', (e) => {
    if (e.target === lbModal) lbModal.classList.remove('visible');
});

const homeBtn = document.getElementById('home-btn');
homeBtn.addEventListener('click', () => {
    window.location.reload();
});

function onGameEnd(finalScore, elapsed) {
    const callsign = callsignInput.value.trim().toUpperCase() || 'ANON';
    const entries = Leaderboard.addEntry(callsign, finalScore, elapsed);
    const rank = entries.findIndex(e => e.score === finalScore && e.callsign === callsign) + 1;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    showMessage(
        `TIME'S UP!\nFINAL SCORE: ${finalScore.toLocaleString()}\nTIME: ${m}:${s.toString().padStart(2, '0')}\n#${rank} on the leaderboard`,
        999999
    );
    homeBtn.style.display = 'block';
}

// Stop callsign input from triggering game controls
callsignInput.addEventListener('keydown', (e) => e.stopPropagation());
callsignInput.addEventListener('keyup', (e) => e.stopPropagation());

// Start autopilot for menu background
Autopilot.start();

// Start button — auto-starts Gemini and the game together
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
startBtn.addEventListener('click', () => {
    const callsign = callsignInput.value.trim().toUpperCase();
    if (!callsign) {
        callsignInput.style.borderColor = '#EA4335';
        callsignInput.focus();
        callsignInput.placeholder = 'callsign required!';
        return;
    }
    callsignInput.style.borderColor = '';

    // Generate prompt with the callsign
    geminiPrompt = ScoringRules.getGeminiPrompt(callsign);
    console.log('=== GEMINI SYSTEM PROMPT ===\n');
    console.log(geminiPrompt);
    console.log('\n=== END PROMPT ===');

    startScreen.classList.add('hidden');
    Autopilot.stop();
    Audio.init(); // must be in user gesture
    startGame(onGameEnd);
    connectGemini();
});

// Game loop
let lastTime = performance.now();

function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (Autopilot.isActive()) {
        // Menu screen — fly on autopilot
        const autoInput = Autopilot.getInput(dt);
        const aircraftState = updateAircraft(dt, autoInput);
        updateCamera(aircraftState.position, aircraftState.quaternion, dt);
    } else if (isRunning()) {
        updateGameState();

        const aircraftState = updateAircraft(dt);
        updateCamera(aircraftState.position, aircraftState.quaternion, dt);
        Audio.updateEngine(aircraftState.speed, CONFIG.aircraft.baseSpeed, CONFIG.aircraft.boostSpeed);

        // Out of bounds warning
        const oobWarning = document.getElementById('oob-warning');
        if (aircraftState.outOfBounds) {
            oobWarning.classList.add('visible');
        } else {
            oobWarning.classList.remove('visible');
        }

        const result = updateTargets(aircraftState.position, dt, now / 1000);
        if (result.justCollected !== null) {
            addPoints(result.justCollected);
            Audio.playCollect(result.justCollected);
        }

        // Secret cloud bonus
        const cloudPoints = updateClouds(aircraftState.position, dt);
        if (cloudPoints !== null) {
            addPoints(cloudPoints);
            Audio.playCollect(cloudPoints);
        }
    }

    renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
