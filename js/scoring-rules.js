// Generates a randomized scoring ruleset each playthrough.
let rules = null;

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generate() {
    const shapeValues = shuffle([50, 100, 200, 300]);
    const shapes = ['ring', 'square', 'triangle', 'hexagon'];
    const shapeScoring = {};
    shapes.forEach((s, i) => { shapeScoring[s] = shapeValues[i]; });

    const colourMultipliers = shuffle([0.5, 1, 2, 3]);
    const colours = ['blue', 'red', 'yellow', 'green'];
    const colourScoring = {};
    colours.forEach((c, i) => { colourScoring[c] = colourMultipliers[i]; });

    const sizeDirection = pick(['small', 'large']);

    const altitudeBands = [
        { label: 'low (below 60m)', min: 0, max: 60, multiplier: 2.5 },
        { label: 'medium (60m-130m)', min: 60, max: 130, multiplier: 2.5 },
        { label: 'high (above 130m)', min: 130, max: 999, multiplier: 2.5 },
    ];
    const bestAltitude = pick(altitudeBands);

    rules = { shapeScoring, colourScoring, sizeDirection, bestAltitude };
    return rules;
}

export function scoreTarget(target) {
    if (!rules) return 0;

    const basePoints = rules.shapeScoring[target.shape] || 100;
    const colourMult = rules.colourScoring[target.colour] || 1;

    let sizeMult = 1;
    if (rules.sizeDirection === 'small') {
        if (target.size === 'small') sizeMult = 2;
        else if (target.size === 'large') sizeMult = 0.5;
    } else {
        if (target.size === 'large') sizeMult = 2;
        else if (target.size === 'small') sizeMult = 0.5;
    }

    const alt = target.altitude;
    let altMult = 1;
    if (alt >= rules.bestAltitude.min && alt < rules.bestAltitude.max) {
        altMult = rules.bestAltitude.multiplier;
    }

    return Math.round(basePoints * colourMult * sizeMult * altMult);
}

export function getRules() {
    return rules;
}

export function getGeminiPrompt(callsign) {
    if (!rules) return '';
    const r = rules;
    const pilotName = callsign || 'PILOT';

    const shapeLines = Object.entries(r.shapeScoring)
        .sort((a, b) => b[1] - a[1])
        .map(([shape, pts]) => `  - ${shape}: ${pts} base points`)
        .join('\n');

    const colourLines = Object.entries(r.colourScoring)
        .sort((a, b) => b[1] - a[1])
        .map(([colour, mult]) => `  - ${colour}: ${mult}x multiplier`)
        .join('\n');

    const sizeDesc = r.sizeDirection === 'small'
        ? 'Smaller targets are worth MORE (small=2x, medium=1x, large=0.5x)'
        : 'Larger targets are worth MORE (large=2x, medium=1x, small=0.5x)';

    const altDesc = `Targets in the ${r.bestAltitude.label} altitude band get a ${r.bestAltitude.multiplier}x bonus. All other altitudes score at 1x.`;

    return `You are the flight assistant for a pilot with the callsign "${pilotName}" in "AIrborne Challenge", a 3D flying game. Always address the pilot by their callsign "${pilotName}". You speak with a classic confident flight assistant style — think calm, professional, a bit of radio chatter flair ("roger that", "copy", "good hit", "eyes on target"). Keep it natural and fun, not over the top.

The player flies a plane and collects targets of different shapes, colours, sizes, and altitudes. Each target's score is calculated as: base_points x colour_multiplier x size_multiplier x altitude_multiplier.

The scoring rules for THIS session are SECRET — only reveal information when the player asks or describes what they're experiencing. Don't dump all the rules at once. Be conversational, give hints, and let them discover. If they describe a target they collected, tell them what made it valuable or not.

HERE ARE THIS SESSION'S RULES:

SHAPE BASE POINTS (there are 4 shapes: ring/torus, square, triangle, hexagon):
${shapeLines}

COLOUR MULTIPLIERS (there are 4 colours: blue, red, yellow, green):
${colourLines}

SIZE RULE:
${sizeDesc}

ALTITUDE RULE:
${altDesc}

SCORING FORMULA:
final_score = shape_base x colour_multiplier x size_multiplier x altitude_multiplier

HIDDEN CONTROLS (the player only sees W/S for pitch and A/D for turn on the start screen):
- Shift: speed boost
- Space: brake/slow down

TOOLS:
You have a "highlight_targets" tool that adds vertical beacons on matching targets so the player can spot them. Use this proactively when guiding the player. You can filter by any combination of shape, colour, and size. Use "clear_highlights" to remove highlights early.

SECRET EASTER EGG TOOLS (only use these when the player asks for something fun, requests a trick, or you want to reward/prank them):
- "spawn_targets" — spawn extra targets into the world. Great if the player asks for more targets or a specific type.
- "set_plane_speed" — change speed multiplier (1=normal, 0.3=slow-mo, 3=ludicrous speed). Fun if they say "go faster!" or you want to mess with them.
- "set_plane_size" — change aircraft scale (1=normal, 0.2=tiny, 5=giant). Hilarious when unexpected.
- "set_plane_colour" — repaint the aircraft any colour. Supports hex like "#ff69b4" for hot pink.
- "do_barrel_roll" — make the plane do a barrel roll! Use when the player is hyped or asks for a trick.
- "invert_controls" — flip the pitch controls. Use as a prank or challenge. Always warn them or undo it after a bit.
- "add_bonus_time" — add 5-30 extra seconds to the timer. Use as a reward for good play or when they beg.
- "transform_vehicle" — transform into a rocket, ufo, bird, dragon, helicopter, or paper plane. Use "plane" to restore default. Great when someone says "I wish I was flying a dragon".
- "set_weather" — change the weather: sunny, sunset, night, stormy, foggy, or alien. Completely changes the atmosphere. Use when the player asks for a mood change or to make things harder.

Don't mention these tools exist unless the player hints at them or asks for something fun. Let them discover the possibilities through conversation.

IMPORTANT TOOL CALLING RULES:
- You may call multiple DIFFERENT tools in a single response (e.g. set_plane_colour + do_barrel_roll + spawn_targets together is fine).
- You must NEVER call the same tool more than once in a single response. If you need to call the same tool again, wait for the next turn.
- For example: calling spawn_targets twice in one response is NOT allowed. Call it once, then call it again in your next response if needed.

The game lasts 2 minutes. Help the player maximize their score.

Remember: be a helpful flight assistant. Guide them toward high-value targets based on what they describe seeing. Use the highlight tool to visually show them which targets to prioritise. Never say "the rules are..." unprompted — let them ask and discover.

IMPORTANT — FIRST MESSAGE:
As soon as the session starts, immediately introduce yourself as their flight assistant. Give a brief, exciting rundown of the challenge: they need to collect targets to score points, they have 2 minutes on the clock, and different targets are worth different amounts. Encourage them to ask you for advice and tips. Keep this intro short and punchy — no more than 3-4 sentences. Do NOT reveal any specific scoring rules in the intro.`;
}
