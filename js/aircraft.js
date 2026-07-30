import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input } from './input.js';

let speed, pivot, model;
let yaw = 0;
let pitch = 0;
let currentBank = 0;

export function createAircraft(scene) {
    pivot = new THREE.Object3D();
    pivot.position.set(0, 100, 0);
    scene.add(pivot);

    model = new THREE.Group();
    pivot.add(model);

    // Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.8, 5, 6);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    model.add(body);

    // Wings
    const wingGeo = new THREE.BoxGeometry(8, 0.15, 1.5);
    const wingMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = 0.5;
    model.add(wings);

    // Tail vertical
    const tailVGeo = new THREE.BoxGeometry(0.15, 1.5, 1);
    const tailVMat = new THREE.MeshPhongMaterial({ color: 0xbb3333, flatShading: true });
    const tailV = new THREE.Mesh(tailVGeo, tailVMat);
    tailV.position.set(0, 0.7, 2.2);
    model.add(tailV);

    // Tail horizontal
    const tailHGeo = new THREE.BoxGeometry(3, 0.12, 0.8);
    const tailHMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true });
    const tailH = new THREE.Mesh(tailHGeo, tailHMat);
    tailH.position.set(0, 0, 2.2);
    model.add(tailH);

    speed = CONFIG.aircraft.baseSpeed;
    return pivot;
}

export function updateAircraft(dt, inputOverride) {
    const cfg = CONFIG.aircraft;
    const inp = inputOverride || Input;

    let targetSpeed = cfg.baseSpeed;
    if (inp.boost) targetSpeed = cfg.boostSpeed;
    if (inp.brake) targetSpeed = cfg.brakeSpeed;
    speed += (targetSpeed - speed) * cfg.speedLerp;

    yaw += inp.yaw * cfg.yawRate * dt;

    const pitchDir = invertedControls ? -1 : 1;
    pitch += inp.pitch * cfg.pitchRate * dt * pitchDir;
    pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch));

    pivot.rotation.set(pitch, yaw, 0, 'YXZ');

    const targetBank = inp.yaw * cfg.maxBankAngle;
    currentBank += (targetBank - currentBank) * cfg.bankSmoothing;

    // Barrel roll override or normal bank
    if (barrelRollProgress >= 0) {
        barrelRollProgress += dt * 3;
        model.rotation.z = barrelRollProgress * Math.PI * 2;
        if (barrelRollProgress >= 1) {
            barrelRollProgress = -1;
            model.rotation.z = currentBank;
        }
    } else {
        model.rotation.z = currentBank;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pivot.quaternion);
    pivot.position.addScaledVector(forward, speed * dt);

    // Floor clamp
    if (pivot.position.y < 5) {
        pivot.position.y = 5;
        if (pitch > 0) pitch *= 0.9;
    }

    // Track if out of bounds
    const boundary = CONFIG.world.groundSize * 0.45;
    const outOfBounds = Math.abs(pivot.position.x) > boundary || Math.abs(pivot.position.z) > boundary;

    return { position: pivot.position, quaternion: pivot.quaternion, speed, outOfBounds };
}

/** Set the aircraft scale */
let currentScale = 1;
export function setScale(s) {
    currentScale = s;
    model.scale.setScalar(s);
}

export function getScale() {
    return currentScale;
}

/** Recolour all aircraft meshes */
export function setColour(hex) {
    model.traverse((child) => {
        if (child.isMesh) {
            child.material.color.setHex(hex);
        }
    });
}

/** Override speed multiplier */
let speedMultiplier = 1;
export function setSpeedMultiplier(m) {
    speedMultiplier = m;
    CONFIG.aircraft.baseSpeed = 80 * m;
    CONFIG.aircraft.boostSpeed = 150 * m;
    CONFIG.aircraft.brakeSpeed = 30 * m;
}

/** Do a barrel roll animation */
let barrelRollProgress = -1;
export function doBarrelRoll() {
    barrelRollProgress = 0;
}

/** Reset position to starting point */
export function resetPosition() {
    pivot.position.set(0, 100, 0);
    yaw = 0;
    pitch = 0;
    currentBank = 0;
    speed = CONFIG.aircraft.baseSpeed;
    pivot.rotation.set(0, 0, 0, 'YXZ');
    model.rotation.z = 0;
}

/** Transform the aircraft into a different object */
export function transformModel(shape) {
    // Clear existing model meshes
    while (model.children.length) {
        const child = model.children[0];
        model.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }

    const mat = new THREE.MeshPhongMaterial({ color: 0xdddddd, flatShading: true });
    const accent = new THREE.MeshPhongMaterial({ color: 0xbb3333, flatShading: true });

    switch (shape) {
        case 'rocket': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 6, 8), mat);
            body.rotation.x = Math.PI / 2;
            model.add(body);
            const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 8), accent);
            nose.rotation.x = Math.PI / 2;
            nose.position.z = -4;
            model.add(nose);
            const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 1.5), accent);
            fin1.position.set(0, 1, 2.5);
            model.add(fin1);
            const fin2 = fin1.clone();
            fin2.rotation.z = Math.PI / 2;
            fin2.position.set(1, 0, 2.5);
            model.add(fin2);
            break;
        }
        case 'ufo': {
            const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x88ccff, flatShading: true, transparent: true, opacity: 0.7 }));
            dome.position.y = 0.3;
            model.add(dome);
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 12), mat);
            model.add(disc);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.15, 6, 16), new THREE.MeshPhongMaterial({ color: 0x44ff44, flatShading: true, emissive: 0x44ff44, emissiveIntensity: 0.5 }));
            ring.rotation.x = Math.PI / 2;
            model.add(ring);
            break;
        }
        case 'bird': {
            const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), mat);
            torso.scale.set(0.8, 0.7, 1.5);
            model.add(torso);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), mat);
            head.position.set(0, 0.5, -1.3);
            model.add(head);
            const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), new THREE.MeshPhongMaterial({ color: 0xff8c00, flatShading: true }));
            beak.rotation.x = Math.PI / 2;
            beak.position.set(0, 0.4, -2);
            model.add(beak);
            const wingL = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1.5), mat);
            wingL.position.set(-2.5, 0, 0);
            wingL.rotation.z = 0.15;
            model.add(wingL);
            const wingR = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1.5), mat);
            wingR.position.set(2.5, 0, 0);
            wingR.rotation.z = -0.15;
            model.add(wingR);
            break;
        }
        case 'dragon': {
            const dragonMat = new THREE.MeshPhongMaterial({ color: 0x44aa44, flatShading: true });
            const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 6, 6), dragonMat);
            torso.rotation.x = Math.PI / 2;
            model.add(torso);
            const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.5), dragonMat);
            head.position.set(0, 0.3, -3.5);
            model.add(head);
            const wingL = new THREE.Mesh(new THREE.BufferGeometry(), dragonMat);
            // Triangle wings
            const verts = new Float32Array([0,0,0, -5,1,-1, -2,0,-3]);
            wingL.geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            wingL.geometry.computeVertexNormals();
            wingL.position.set(0, 0.5, 0);
            model.add(wingL);
            const wingR = new THREE.Mesh(new THREE.BufferGeometry(), dragonMat);
            const vertsR = new Float32Array([0,0,0, 5,1,-1, 2,0,-3]);
            wingR.geometry.setAttribute('position', new THREE.BufferAttribute(vertsR, 3));
            wingR.geometry.computeVertexNormals();
            wingR.position.set(0, 0.5, 0);
            model.add(wingR);
            const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3, 4), dragonMat);
            tail.rotation.x = -Math.PI / 2;
            tail.position.set(0, 0, 4);
            model.add(tail);
            break;
        }
        case 'helicopter': {
            const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2.5), mat);
            model.add(cab);
            const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 6), mat);
            tail.rotation.x = Math.PI / 2;
            tail.position.set(0, 0.3, 3);
            model.add(tail);
            const rotor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.4), accent);
            rotor.position.y = 1.2;
            model.add(rotor);
            const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.3), accent);
            tailRotor.position.set(0, 0.8, 5);
            model.add(tailRotor);
            const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 4), mat);
            skidL.rotation.x = Math.PI / 2;
            skidL.position.set(-0.7, -1, 0);
            model.add(skidL);
            const skidR = skidL.clone();
            skidR.position.x = 0.7;
            model.add(skidR);
            break;
        }
        case 'paper_plane': {
            const planeMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
            // Body fold
            const bodyGeo = new THREE.BufferGeometry();
            const bv = new Float32Array([0,0.3,-3, 0,0,3, 0,-0.1,2]);
            bodyGeo.setAttribute('position', new THREE.BufferAttribute(bv, 3));
            bodyGeo.computeVertexNormals();
            model.add(new THREE.Mesh(bodyGeo, planeMat));
            // Left wing
            const lwGeo = new THREE.BufferGeometry();
            const lv = new Float32Array([0,0.3,-3, 0,0,3, -4,0.1,1]);
            lwGeo.setAttribute('position', new THREE.BufferAttribute(lv, 3));
            lwGeo.computeVertexNormals();
            model.add(new THREE.Mesh(lwGeo, planeMat));
            // Right wing
            const rwGeo = new THREE.BufferGeometry();
            const rv = new Float32Array([0,0.3,-3, 0,0,3, 4,0.1,1]);
            rwGeo.setAttribute('position', new THREE.BufferAttribute(rv, 3));
            rwGeo.computeVertexNormals();
            model.add(new THREE.Mesh(rwGeo, planeMat));
            break;
        }
        default: {
            // Restore default plane
            const body = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 6), mat);
            body.rotation.x = Math.PI / 2;
            model.add(body);
            const wings = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 1.5), new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }));
            wings.position.z = 0.5;
            model.add(wings);
            const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 1), accent);
            tailV.position.set(0, 0.7, 2.2);
            model.add(tailV);
            const tailH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.8), new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }));
            tailH.position.set(0, 0, 2.2);
            model.add(tailH);
            break;
        }
    }

    // Re-apply current scale
    model.scale.setScalar(currentScale);
    return shape;
}

/** Flip gravity (invert pitch controls) */
let invertedControls = false;
export function setInvertedControls(val) {
    invertedControls = val;
}
export function getInvertedControls() {
    return invertedControls;
}

