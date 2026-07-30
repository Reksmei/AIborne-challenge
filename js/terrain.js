import * as THREE from 'three';
import { CONFIG } from './config.js';
import { getScale } from './aircraft.js';

const clouds = [];
const poppingClouds = [];
const GOOGLE_COLOURS = [0x4285F4, 0xEA4335, 0xFBBC04, 0x34A853];
const CLOUD_COLLECT_RADIUS = 25;
const CLOUD_BONUS_POINTS = 500;

let sceneRef = null;

export function createTerrain(scene) {
    sceneRef = scene;
    const cfg = CONFIG.world;

    // Ground with gentle hills
    const groundGeo = new THREE.PlaneGeometry(cfg.groundSize, cfg.groundSize, 40, 40);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = Math.sin(x * 0.008) * Math.cos(y * 0.008) * 15 +
                  Math.sin(x * 0.02) * Math.cos(y * 0.015) * 5;
        posAttr.setZ(i, z);
    }
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(groundGeo, new THREE.MeshPhongMaterial({
        color: 0x4a7c3f, flatShading: true,
    }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    createTrees(scene, cfg);
    createClouds(scene, cfg);
}

function createTrees(scene, cfg) {
    const treeGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 5);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B6914, flatShading: true });
    const leafGeo = new THREE.ConeGeometry(3, 8, 6);
    const leafMat = new THREE.MeshPhongMaterial({ color: 0x2d6b1e, flatShading: true });

    for (let i = 0; i < cfg.treeCount; i++) {
        const x = (Math.random() - 0.5) * cfg.groundSize * 0.8;
        const z = (Math.random() - 0.5) * cfg.groundSize * 0.8;
        const scale = 0.8 + Math.random() * 1.5;

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 2 * scale, z);
        trunk.scale.setScalar(scale);
        treeGroup.add(trunk);

        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(x, 8 * scale, z);
        leaf.scale.setScalar(scale);
        treeGroup.add(leaf);
    }
    scene.add(treeGroup);
}

function createClouds(scene, cfg) {
    const cloudGeo = new THREE.SphereGeometry(1, 6, 6);
    const cloudMat = new THREE.MeshPhongMaterial({
        color: 0xffffff, flatShading: true, transparent: true, opacity: 0.8,
    });

    for (let i = 0; i < cfg.cloudCount; i++) {
        const cloudGroup = new THREE.Group();
        const puffCount = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < puffCount; j++) {
            const puff = new THREE.Mesh(cloudGeo, cloudMat.clone());
            puff.position.set(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 8
            );
            const s = 4 + Math.random() * 6;
            puff.scale.set(s, s * 0.5, s * 0.7);
            cloudGroup.add(puff);
        }
        cloudGroup.position.set(
            (Math.random() - 0.5) * cfg.groundSize,
            150 + Math.random() * 200,
            (Math.random() - 0.5) * cfg.groundSize
        );
        cloudGroup.userData = { collected: false, baseScale: 1 };
        scene.add(cloudGroup);
        clouds.push(cloudGroup);
    }
}

/**
 * Check if the aircraft has flown through a cloud.
 * Collected clouds pop into Google colours and disappear.
 * Returns points if a cloud was collected, null otherwise.
 */
export function updateClouds(aircraftPos, dt) {
    let points = null;

    for (const cloud of clouds) {
        if (cloud.userData.collected) continue;

        const dist = aircraftPos.distanceTo(cloud.position);
        const effectiveRadius = CLOUD_COLLECT_RADIUS + (getScale() - 1) * 5;
        if (dist < effectiveRadius) {
            cloud.userData.collected = true;
            cloud.userData.popProgress = 0;

            // Colour each puff a random Google colour
            cloud.traverse((child) => {
                if (child.isMesh) {
                    const gc = GOOGLE_COLOURS[Math.floor(Math.random() * GOOGLE_COLOURS.length)];
                    child.material.color.setHex(gc);
                    child.material.emissive = new THREE.Color(gc);
                    child.material.emissiveIntensity = 0.6;
                }
            });

            poppingClouds.push(cloud);
            points = CLOUD_BONUS_POINTS;
        }
    }

    // Animate popping clouds
    const POP_DURATION = 0.5;
    for (let i = poppingClouds.length - 1; i >= 0; i--) {
        const c = poppingClouds[i];
        c.userData.popProgress += dt / POP_DURATION;
        const p = c.userData.popProgress;

        if (p >= 1) {
            c.visible = false;
            poppingClouds.splice(i, 1);
        } else {
            // Expand and fade
            const scale = 1 + p * 2;
            c.scale.setScalar(scale);
            c.traverse((child) => {
                if (child.isMesh) {
                    child.material.opacity = 0.8 * (1 - p);
                }
            });
        }
    }

    return points;
}
