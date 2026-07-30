/**
 * Autopilot — flies the plane in lazy circles during the menu screen.
 * Overrides Input values so the existing aircraft update just works.
 */

import { Input } from './input.js';

let active = false;
let time = 0;

export function start() {
    active = true;
    time = 0;
}

export function stop() {
    active = false;
}

export function isActive() {
    return active;
}

/**
 * Returns fake input values for autopilot flight.
 * Gentle sinusoidal yaw + pitch for lazy circling.
 */
export function getInput(dt) {
    if (!active) return null;
    time += dt;

    return {
        pitch: 0,
        yaw: 0.35,  // constant gentle turn = flat circle
        boost: false,
        brake: false,
    };
}
