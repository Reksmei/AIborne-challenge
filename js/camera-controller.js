import * as THREE from 'three';
import { CONFIG } from './config.js';
import { getScale } from './aircraft.js';

let cam;
const currentPos = new THREE.Vector3();
const currentLook = new THREE.Vector3();

export function initCamera(camera) {
    cam = camera;
    currentPos.copy(cam.position);
    currentLook.set(0, 100, -30);
}

export function updateCamera(aircraftPos, aircraftQuat, dt) {
    const cfg = CONFIG.camera;
    const s = Math.max(1, getScale());

    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(aircraftQuat);
    const upOffset = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraftQuat);

    const targetPos = aircraftPos.clone()
        .add(back.multiplyScalar(cfg.followDistance * s))
        .add(upOffset.multiplyScalar(cfg.followHeight * s));

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraftQuat);
    const targetLook = aircraftPos.clone()
        .add(fwd.multiplyScalar(cfg.lookAheadDistance * s));

    currentPos.lerp(targetPos, cfg.smoothing);
    currentLook.lerp(targetLook, cfg.smoothing);

    cam.position.copy(currentPos);
    cam.lookAt(currentLook);
}
