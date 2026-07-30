import { CONFIG } from './config.js';
import * as HUD from './hud.js';

let score = 0;
let startTime = 0;
let elapsed = 0;
let remaining = 0;
let running = false;
let finished = false;
let _onGameEnd = null;

export function startGame(onGameEnd) {
    score = 0;
    startTime = performance.now();
    elapsed = 0;
    remaining = CONFIG.gameDuration;
    running = true;
    finished = false;
    _onGameEnd = onGameEnd || null;
    HUD.updateScore(0);
    HUD.updateTimer(CONFIG.gameDuration);
    HUD.showMessage('GO!', 1500);
}

export function updateGameState() {
    if (!running) return;
    elapsed = (performance.now() - startTime) / 1000;
    remaining = Math.max(0, CONFIG.gameDuration - elapsed);
    HUD.updateTimer(remaining);

    if (remaining <= 0 && !finished) {
        finished = true;
        running = false;
        _onGameEnd?.(score, elapsed);
    }
}

export function addPoints(points) {
    score += points;
    HUD.updateScore(score);
    HUD.showPoints(points);
}

export function getScore() { return score; }
export function isRunning() { return running; }
