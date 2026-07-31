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
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    if (elTimer) {
        elTimer.innerHTML = `<span class="timer-label">TIME</span><span class="timer-val">${timeStr}</span>`;
        if (seconds <= 15 && seconds > 0) {
            elTimer.classList.add('urgent');
        } else {
            elTimer.classList.remove('urgent');
        }
    }
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
    if (elMessage) {
        elMessage.innerText = text;
        elMessage.classList.add('visible');
        if (messageTimeout) clearTimeout(messageTimeout);
        messageTimeout = setTimeout(() => {
            elMessage.classList.remove('visible');
        }, duration);
    }
}

export function showControls(duration = 6) {
    const controlsText = "🎮 FLIGHT CONTROLS\n\n• W / S — Pitch Down / Up\n• A / D — Turn Left / Right\n• Shift — Speed Boost\n• Space — Air Brake\n• T — Push-To-Talk Radio";
    showMessage(controlsText, duration * 1000);
}
