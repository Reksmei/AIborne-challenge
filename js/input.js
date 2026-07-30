const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

export const Input = {
    get pitch() {
        return (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
               (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    },
    get yaw() {
        return (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) -
               (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
    },
    get boost() { return keys['ShiftLeft'] || keys['ShiftRight']; },
    get brake() { return keys['Space']; },
};
