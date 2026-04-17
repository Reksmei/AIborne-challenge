let elScore, elTimer, elMessage, elPoints;
let messageTimeout = null;
let pointsTimeout = null;

export function initHUD() {
    elScore = document.getElementById('hud-score');
    elTimer = document.getElementById('hud-timer');
    elMessage = document.getElementById('hud-message');
    elPoints = document.getElementById('hud-points');
}

export function updateScore(score) {
    elScore.textContent = score;
}

export function updateTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    elTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

export function showPoints(points) {
    elPoints.textContent = `+${points}`;
    elPoints.classList.remove('visible');
    void elPoints.offsetWidth;
    elPoints.classList.add('visible');
    if (pointsTimeout) clearTimeout(pointsTimeout);
    pointsTimeout = setTimeout(() => {
        elPoints.classList.remove('visible');
    }, 1200);
}

export function showMessage(text, duration = 2000) {
    elMessage.textContent = text;
    elMessage.classList.add('visible');
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        elMessage.classList.remove('visible');
    }, duration);
}
