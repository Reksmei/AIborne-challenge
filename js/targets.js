import * as THREE from 'three';
import { CONFIG } from './config.js';
import { scoreTarget } from './scoring-rules.js';
import { getScale } from './aircraft.js';

const targets = [];
const popping = []; // targets currently in pop animation
const beacons = []; // active beacon meshes
let collected = 0;
let sceneRef = null;

const COLOURS = {
    blue:   { hex: 0x4285F4, emissive: 0x112244 },
    red:    { hex: 0xEA4335, emissive: 0x441111 },
    yellow: { hex: 0xFBBC04, emissive: 0x443300 },
    green:  { hex: 0x34A853, emissive: 0x114422 },
};
const COLOUR_KEYS = Object.keys(COLOURS);
const SHAPE_KEYS = ['ring', 'square', 'triangle', 'hexagon'];
const SIZES = {
    small:  { scale: 0.6, collectMult: 0.7 },
    medium: { scale: 1.0, collectMult: 1.0 },
    large:  { scale: 1.5, collectMult: 1.4 },
};
const SIZE_KEYS = Object.keys(SIZES);

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function createGeometry(shapeKey) {
    const cfg = CONFIG.world;
    switch (shapeKey) {
        case 'ring':     return new THREE.TorusGeometry(cfg.ringRadius, cfg.ringTubeRadius, 8, 24);
        case 'square':   return new THREE.TorusGeometry(cfg.ringRadius, cfg.ringTubeRadius, 4, 4);
        case 'triangle': return new THREE.TorusGeometry(cfg.ringRadius, cfg.ringTubeRadius, 3, 3);
        case 'hexagon':  return new THREE.TorusGeometry(cfg.ringRadius, cfg.ringTubeRadius, 6, 6);
        default:         return new THREE.TorusGeometry(cfg.ringRadius, cfg.ringTubeRadius, 8, 24);
    }
}

export function createTargets(scene) {
    sceneRef = scene;
    const cfg = CONFIG.world;

    for (let i = 0; i < cfg.targetCount; i++) {
        const shapeKey = pickRandom(SHAPE_KEYS);
        const colourKey = pickRandom(COLOUR_KEYS);
        const sizeKey = pickRandom(SIZE_KEYS);

        const geo = createGeometry(shapeKey);
        const colourDef = COLOURS[colourKey];
        const sizeDef = SIZES[sizeKey];

        const mat = new THREE.MeshPhongMaterial({
            color: colourDef.hex,
            flatShading: true,
            emissive: colourDef.emissive,
            emissiveIntensity: 0.3,
        });

        const mesh = new THREE.Mesh(geo, mat);

        const altitude = cfg.targetMinHeight +
            Math.random() * (cfg.targetMaxHeight - cfg.targetMinHeight);
        mesh.position.set(
            (Math.random() - 0.5) * cfg.groundSize * 0.9,
            altitude,
            (Math.random() - 0.5) * cfg.groundSize * 0.9
        );
        mesh.rotation.set(
            Math.random() * Math.PI * 0.3,
            Math.random() * Math.PI * 2,
            0
        );
        mesh.scale.setScalar(sizeDef.scale);

        mesh.userData = {
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2,
            shape: shapeKey,
            colour: colourKey,
            size: sizeKey,
            altitude: altitude,
            baseScale: sizeDef.scale,
            collectRadius: CONFIG.collectRadius * sizeDef.collectMult,
        };

        scene.add(mesh);
        targets.push(mesh);
    }
    collected = 0;
}

export function updateTargets(aircraftPos, dt, time) {
    let justCollected = null;
    for (const target of targets) {
        if (target.userData.collected) continue;

        target.rotation.y += 0.5 * dt;

        const pulse = 1 + Math.sin(time * 2 + target.userData.pulsePhase) * 0.05;
        target.scale.setScalar(target.userData.baseScale * pulse);

        const dist = aircraftPos.distanceTo(target.position);
        const effectiveRadius = target.userData.collectRadius + (getScale() - 1) * 5;
        if (dist < effectiveRadius) {
            target.userData.collected = true;
            collected++;

            // Start pop animation
            target.material.transparent = true;
            target.material.emissive.setHex(0xffffff);
            target.material.emissiveIntensity = 1;
            target.userData.popProgress = 0;
            popping.push(target);

            justCollected = scoreTarget({
                shape: target.userData.shape,
                colour: target.userData.colour,
                size: target.userData.size,
                altitude: target.userData.altitude,
            });
        }
    }

    // Animate popping targets
    const POP_DURATION = 0.25; // seconds
    for (let i = popping.length - 1; i >= 0; i--) {
        const t = popping[i];
        t.userData.popProgress += dt / POP_DURATION;
        const p = t.userData.popProgress;

        if (p >= 1) {
            // Done — hide completely
            t.visible = false;
            popping.splice(i, 1);
        } else {
            // Scale up and fade out
            const scale = t.userData.baseScale * (1 + p * 1.5);
            t.scale.setScalar(scale);
            t.material.opacity = 1 - p;
        }
    }

    return { justCollected, collected, total: targets.length };
}

export function getTargetStats() {
    return { collected, total: targets.length };
}

/**
 * Spawn extra targets of a specific type near a position.
 */
export function spawnTargets({ shape, colour, size, count, nearPos }) {
    if (!sceneRef) return 0;
    const cfg = CONFIG.world;
    const shapeKey = shape || pickRandom(SHAPE_KEYS);
    const colourKey = colour || pickRandom(COLOUR_KEYS);
    const sizeKey = size || pickRandom(SIZE_KEYS);
    const spawned = count || 10;

    for (let i = 0; i < spawned; i++) {
        const geo = createGeometry(shapeKey);
        const colourDef = COLOURS[colourKey];
        const sizeDef = SIZES[sizeKey];
        if (!colourDef || !sizeDef) continue;

        const mat = new THREE.MeshPhongMaterial({
            color: colourDef.hex,
            flatShading: true,
            emissive: colourDef.emissive,
            emissiveIntensity: 0.3,
        });
        const mesh = new THREE.Mesh(geo, mat);

        // Spawn across the map, or near a position if provided
        const cx = nearPos ? nearPos.x : 0;
        const cz = nearPos ? nearPos.z : 0;
        const spread = nearPos ? 400 : cfg.groundSize * 0.9;
        const altitude = cfg.targetMinHeight +
            Math.random() * (cfg.targetMaxHeight - cfg.targetMinHeight);
        mesh.position.set(
            cx + (Math.random() - 0.5) * spread,
            altitude,
            cz + (Math.random() - 0.5) * spread
        );
        mesh.rotation.set(
            Math.random() * Math.PI * 0.3,
            Math.random() * Math.PI * 2,
            0
        );
        mesh.scale.setScalar(sizeDef.scale);

        mesh.userData = {
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2,
            shape: shapeKey,
            colour: colourKey,
            size: sizeKey,
            altitude,
            baseScale: sizeDef.scale,
            collectRadius: CONFIG.collectRadius * sizeDef.collectMult,
        };

        sceneRef.add(mesh);
        targets.push(mesh);
    }
    return spawned;
}

/**
 * Highlight targets matching a filter query by adding vertical beacons.
 * A glowing column of light extends from the ground up through each
 * matching target, making them easy to spot from any distance.
 * All matching uncollected targets are highlighted simultaneously.
 */
let highlightTimer = null;

// Shared beacon geometry and material (created once)
let beaconGeo = null;
let beaconMat = null;

function getBeaconAssets() {
    if (!beaconGeo) {
        beaconGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    }
    if (!beaconMat) {
        beaconMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
        });
    }
    return { beaconGeo, beaconMat };
}

export function highlightTargets({ shape, colour, size, duration = 8 }) {
    clearHighlights();
    if (!sceneRef) return 0;

    const { beaconGeo, beaconMat } = getBeaconAssets();
    let matchCount = 0;

    for (const target of targets) {
        if (target.userData.collected) continue;

        const matches =
            (!shape  || target.userData.shape  === shape) &&
            (!colour || target.userData.colour === colour) &&
            (!size   || target.userData.size   === size);

        if (matches) {
            // Create a vertical beacon from ground to well above the target
            const beaconHeight = target.position.y + 80;
            const beacon = new THREE.Mesh(beaconGeo, beaconMat.clone());
            beacon.scale.set(1, beaconHeight, 1);
            beacon.position.set(
                target.position.x,
                beaconHeight / 2,
                target.position.z
            );

            // Tint the beacon to match the target's colour
            const colourDef = COLOURS[target.userData.colour];
            if (colourDef) {
                beacon.material.color.setHex(colourDef.hex);
                beacon.material.opacity = 0.3;
            }

            sceneRef.add(beacon);
            beacons.push(beacon);

            // Also boost the target's emissive so it glows
            target.userData.highlighted = true;
            target.userData.origEmissiveHex = target.material.emissive.getHex();
            target.userData.origEmissiveIntensity = target.material.emissiveIntensity;
            target.material.emissive.setHex(0xffffff);
            target.material.emissiveIntensity = 0.6;

            matchCount++;
        }
    }

    // Auto-clear after duration
    highlightTimer = setTimeout(() => {
        clearHighlights();
    }, duration * 1000);

    return matchCount;
}

export function clearHighlights() {
    if (highlightTimer) {
        clearTimeout(highlightTimer);
        highlightTimer = null;
    }

    // Remove beacon meshes from scene
    for (const beacon of beacons) {
        if (sceneRef) sceneRef.remove(beacon);
        beacon.geometry?.dispose();
        beacon.material?.dispose();
    }
    beacons.length = 0;

    // Restore highlighted targets
    for (const target of targets) {
        if (target.userData.highlighted) {
            target.material.emissive.setHex(target.userData.origEmissiveHex);
            target.material.emissiveIntensity = target.userData.origEmissiveIntensity;
            target.userData.highlighted = false;
        }
    }
}
