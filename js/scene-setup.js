import * as THREE from 'three';
import { CONFIG } from './config.js';

let sceneRef, ambientRef, sunRef, hemiRef;

export function initScene() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    document.body.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, CONFIG.world.fogNear, CONFIG.world.fogFar);
    sceneRef = scene;

    const camera = new THREE.PerspectiveCamera(
        65, window.innerWidth / window.innerHeight, 0.5, 2000
    );

    ambientRef = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientRef);

    sunRef = new THREE.DirectionalLight(0xffffff, 0.8);
    sunRef.position.set(200, 400, 100);
    scene.add(sunRef);

    hemiRef = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.3);
    scene.add(hemiRef);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { renderer, scene, camera };
}

const WEATHER_PRESETS = {
    sunny: {
        sky: 0x87CEEB, fog: 0x87CEEB, fogNear: 400, fogFar: 2000,
        ambientIntensity: 0.6, sunIntensity: 0.8, sunColour: 0xffffff,
        hemiSky: 0x87CEEB, hemiGround: 0x556B2F, hemiIntensity: 0.3,
    },
    sunset: {
        sky: 0xff6b35, fog: 0xff8855, fogNear: 300, fogFar: 1800,
        ambientIntensity: 0.4, sunIntensity: 1.0, sunColour: 0xff4400,
        hemiSky: 0xff6b35, hemiGround: 0x442200, hemiIntensity: 0.4,
    },
    night: {
        sky: 0x0a0a2e, fog: 0x0a0a2e, fogNear: 100, fogFar: 800,
        ambientIntensity: 0.15, sunIntensity: 0.2, sunColour: 0x6688cc,
        hemiSky: 0x111133, hemiGround: 0x111111, hemiIntensity: 0.1,
    },
    stormy: {
        sky: 0x3a3a4a, fog: 0x3a3a4a, fogNear: 100, fogFar: 600,
        ambientIntensity: 0.25, sunIntensity: 0.3, sunColour: 0x888888,
        hemiSky: 0x444455, hemiGround: 0x333322, hemiIntensity: 0.15,
    },
    foggy: {
        sky: 0xcccccc, fog: 0xcccccc, fogNear: 50, fogFar: 400,
        ambientIntensity: 0.5, sunIntensity: 0.3, sunColour: 0xdddddd,
        hemiSky: 0xcccccc, hemiGround: 0x999988, hemiIntensity: 0.3,
    },
    alien: {
        sky: 0x1a002a, fog: 0x220033, fogNear: 200, fogFar: 1200,
        ambientIntensity: 0.3, sunIntensity: 0.5, sunColour: 0xcc44ff,
        hemiSky: 0x6600aa, hemiGround: 0x002211, hemiIntensity: 0.3,
    },
};

export function setWeather(preset) {
    const w = WEATHER_PRESETS[preset];
    if (!w || !sceneRef) return false;

    sceneRef.background.setHex(w.sky);
    sceneRef.fog.color.setHex(w.fog);
    sceneRef.fog.near = w.fogNear;
    sceneRef.fog.far = w.fogFar;

    ambientRef.intensity = w.ambientIntensity;
    sunRef.intensity = w.sunIntensity;
    sunRef.color.setHex(w.sunColour);
    hemiRef.color.setHex(w.hemiSky);
    hemiRef.groundColor.setHex(w.hemiGround);
    hemiRef.intensity = w.hemiIntensity;

    return true;
}

export function getWeatherPresets() {
    return Object.keys(WEATHER_PRESETS);
}
