# AIrborne Challenge

A 3D flying game that demonstrates the [Gemini Live API](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api) as a real-time gaming assistant. Built with Three.js and [Firebase AI Logic](https://firebase.google.com/docs/ai-logic).

The player flies a plane collecting targets of different shapes, colours, sizes, and altitudes. The scoring rules are randomized every game and only the AI flight assistant knows them. Players must talk to Gemini to figure out the best strategy.

![Start screen](screenshot.png)
![In-game with Gemini flight assistant](screenshot2.png)

## Setup

1. Create a Firebase project and enable the Vertex AI API
2. Update `js/firebase-config.js` with your Firebase project config
3. Install and run:

```bash
npm install
./dev.sh
```

The app runs on `http://localhost:5173` via Vite dev server.

## How It Works

- Scoring rules (shape values, colour multipliers, size preference, altitude bonus) are randomly generated each playthrough
- The rules are passed to Gemini Live as a system prompt
- Players talk to their AI flight assistant via push-to-talk (T key or mic button) to learn the scoring secrets
- Gemini can highlight targets, spawn more, change the plane, and more via tool calling

## Controls

| Key | Action |
|-----|--------|
| W/S | Pitch up/down |
| A/D | Turn left/right |
| Shift | Boost |
| Space | Brake |
| T | Push to talk |

## Tech Stack

- **Three.js** — 3D rendering
- **Firebase AI SDK** — Gemini Live API (audio conversation + tool calling)
- **Web Audio API** — engine sounds, collect chimes, radio effect on Gemini voice
- **Vite** — dev server and bundling
- **localStorage** — leaderboard persistence

## Frontend Architecture

```mermaid
graph TD
    subgraph BROWSER
        subgraph User Input
            KB[Keyboard<br>WASD, Shift, Space]
            PTT[PTT Button / T key]
        end

        subgraph main.js - orchestrator
            GL[Game Loop] <-->|update| ATC[Aircraft / Targets / Terrain]
            GL --> SE[Scoring Engine]
            SR[scoring-rules.js<br>randomized each game] --> SE
            SE --> TH[Tool Handler<br>switch on tool name]
        end

        KB --> GL
        PTT --> MC

        subgraph gemini-session.js
            MODEL[getLiveGenerativeModel<br>gemini-live-2.5-flash]
            SAC[startAudioConversation<br>functionCallingHandler → tool declarations]
            RCV[session.receive → transcript interception]
            SND[session.send → intro message]
            MODEL --> SAC
            SAC -->|bidirectional audio stream| RCV
            SND --> SAC
        end

        TH -->|tool calls from Gemini| RCV

        subgraph mic-control.js
            MC[Patches getUserMedia<br>to capture mic tracks]
            MC --> TE[track.enabled toggle<br>mute/unmute on PTT]
        end

        MC --> SAC

        subgraph Audio Output Pipeline
            SDK_AC[SDK AudioContext - patched]
            subgraph radio-effect.js
                HP[Highpass 200Hz] --> LP[Lowpass 5000Hz]
                LP --> EQ[Peaking EQ 1200Hz +3dB]
                EQ --> COMP[Compressor]
                COMP --> WS[Waveshaper - distortion]
                WS --> GAIN["Gain (0.9)"]
            end
            SDK_AC --> HP
            GAIN --> SPK1[Speaker]
        end

        RCV --> SDK_AC

        subgraph audio.js
            ENG[Engine sound<br>sawtooth + noise]
            CHM[Collect chime<br>2-tone, scales with points]
        end

        ENG --> SDK_AC
        CHM --> SPK2[Speaker]

        subgraph Custom Tools - via Gemini
            T1[highlight_targets — beacon overlay]
            T2[clear_highlights — remove beacons]
            T3[spawn_targets — add more targets]
            T4[set_plane_speed — speed multiplier]
            T5[set_plane_size — scale up/down]
            T6[set_plane_colour — recolour aircraft]
            T7[do_barrel_roll — spin animation]
            T8[invert_controls — flip pitch/yaw]
            T9[add_bonus_time — extend timer]
            T10[reset_position — teleport to origin]
            T11[transform_vehicle — swap model]
            T12[set_weather — sky/fog/lighting preset]
        end

        TH --> T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10 & T11 & T12
    end

    SAC <-->|WebSocket<br>bidirectional audio + tool calls| GEMINI

    subgraph Firebase AI SDK - VertexAI backend
        GEMINI[Gemini Live API<br>gemini-live-2.5-flash-native-audio]
        GEMINI_FEATURES["• Audio in/out<br>• Output transcription<br>• Function calling<br>• System prompt with<br>  randomized scoring rules + persona"]
    end
```

### Key Patterns

- **AudioContext monkey-patch**: `radio-effect.js` patches the `AudioContext` constructor *before* the SDK creates its own, inserting a filter chain on the destination node to give Gemini's voice a radio crackle
- **getUserMedia monkey-patch**: `mic-control.js` intercepts the SDK's mic request to capture the `MediaStreamTrack`, enabling push-to-talk by toggling `track.enabled`
- **session.receive() wrapper**: `gemini-session.js` wraps the async generator returned by `session.receive()` to intercept transcription messages and surface them in the UI
- **Randomized scoring**: `scoring-rules.js` generates a new formula each game (`shape_base × colour_mult × size_mult × altitude_mult`) and bakes it into the system prompt — the player never sees the rules directly

## Project Structure

```
js/
  main.js              — entry point, tool wiring, game loop
  config.js            — tunable game parameters
  input.js             — keyboard input
  aircraft.js          — plane model, physics, easter egg functions
  camera-controller.js — chase camera (scales with plane size)
  scene-setup.js       — renderer, scene, lights
  terrain.js           — ground, trees, collectible clouds
  targets.js           — shapes with varied colour/size/shape
  scoring-rules.js     — randomized scoring + Gemini system prompt
  game-state.js        — timer, score, game end
  hud.js               — minimal score/timer overlay
  audio.js             — synthesized engine + collect sounds
  radio-effect.js      — audio filter for flight assistant radio voice
  gemini-session.js    — Gemini Live connection + transcription
  mic-control.js       — push-to-talk mic muting
  autopilot.js         — menu screen idle flight
  leaderboard.js       — localStorage leaderboard
  firebase-config.js   — Firebase project config (add your own)
```
