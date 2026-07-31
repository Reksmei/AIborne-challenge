# AIrborne Challenge ✈️🎙️

An interactive 3D flight game and technical showcase demonstrating the **[Gemini Live API](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api)** as a real-time, voice-activated radio copilot. Built with **Three.js**, **Google Cloud Agent Platform**, and **Firebase App Hosting**.

![Start Screen](screenshot.png)
![In-Game Voice Copilot](screenshot2.png)

---

## 🌟 Overview

In **AIrborne Challenge**, the player takes the pilot seat of a 3D aircraft collecting collectible target shapes across a dynamic terrain. Every flight session generates a secret scoring formula (shape base points, colour multipliers, size scale bonuses, and high-altitude bonuses). 

The player communicates with their **Gemini Live AI Radio Copilot** using push-to-talk voice chat or radio text. Gemini acts as a live flight assistant, discovering secret scoring rules, giving tactical tips, highlighting high-value targets in the 3D world in real time, and executing flight commands (barrel rolls, speed changes, weather presets, vehicle transformations) via **Gemini Function Calling**.

---

## 📐 System Architecture Diagram

```mermaid
graph TB
    subgraph Browser Client (SPA)
        subgraph UI & 3D Environment
            ThreeJS["Three.js 3D Engine<br>(Aircraft, Terrain, Targets)"]
            GameLoop["Game Loop & HUD<br>(main.js / game-state.js)"]
            ScoringEngine["Dynamic Scoring Engine<br>(scoring-rules.js)"]
        end

        subgraph Audio Pipeline
            MicInput["Web Speech / Mic API<br>(Push-To-Talk)"]
            WebAudio["Web Audio API<br>(PCM Playback @ 24kHz)"]
            RadioFilter["Radio Effects Chain<br>(AudioNode Filters)"]
        end

        subgraph Real-time Session Engine
            GeminiSession["Gemini Live Engine<br>(js/gemini-session.js)"]
            Keepalive["Keepalive Ping (15s)<br>(clientContent)"]
            AutoReconnect["Auto-Reconnector<br>(Exp Backoff 5x)"]
            ToolExecutor["Client Tool Handler<br>(main.js / aircraft.js)"]
        end
    end

    subgraph Google Cloud Platform / Gemini Live Infrastructure
        GeminiWS["wss://generativelanguage.googleapis.com<br>BidiGenerateContent WebSocket"]
        GeminiModel["Gemini 2.5 Flash Native Audio<br>(models/gemini-2.5-flash-native-audio-preview-12-2025)"]
    end

    subgraph Cloud Infrastructure & Persistence
        AppHosting["Firebase App Hosting<br>(Cloud Run SPA Container)"]
        FirestoreDB["Cloud Firestore / Leaderboard<br>(localStorage / DB)"]
    end

    %% User Interactions
    MicInput -- "Voice / Audio Frames" --> GeminiSession
    ThreeJS <--> GameLoop
    GameLoop --> ScoringEngine

    %% Session Engine Connections
    GeminiSession <== "Direct Bidi WebSocket (JSON & PCM)" ==> GeminiWS
    GeminiWS <--> GeminiModel
    Keepalive --> GeminiSession
    AutoReconnect --> GeminiSession

    %% Output Pipeline
    GeminiWS -- "Native Audio PCM" --> WebAudio
    WebAudio --> RadioFilter
    RadioFilter --> Speaker["Pilot Headset / Speakers"]
    GeminiWS -- "Function Calls" --> ToolExecutor
    ToolExecutor -- "Mutate World / Controls / Weather" --> ThreeJS

    %% Hosting
    AppHosting -- "Serves Production Assets" --> Browser Client (SPA)
    GameLoop -- "Persists Scores" --> FirestoreDB
```

---

## ⚡ How It Works Under the Hood

1. **Direct Bidirectional WebSocket Connection**:
   The client establishes a low-latency WebSocket connection directly to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent` using an API key restricted strictly to `Generative Language API` and HTTP referrers.

2. **Protocol Schema Compliance & Tool Declaration**:
   All tool schemas (`highlight_targets`, `spawn_targets`, `set_weather`, `do_barrel_roll`, `set_plane_speed`, etc.) are automatically sanitized into strict protobuf JSON schema format (`function_declarations` with uppercase types `'OBJECT'`, `'STRING'`, `'NUMBER'`, `'BOOLEAN'`).

3. **Real-time Native Audio Processing**:
   Gemini Live streams native 24kHz audio PCM chunks over the WebSocket. The client decodes the raw Int16 PCM byte array into Float32 audio buffers and routes it through a custom **Web Audio API Radio Filter** (high-pass/low-pass bandpass filters with mild distortion) to recreate authentic cockpit radio chatter.

4. **Bi-directional Function Calling Execution Loop**:
   When the pilot asks Gemini for help or fun flight maneuvers, Gemini emits `toolCall` messages over the WebSocket. The client executes the matching function locally in Three.js (e.g. creating visual vertical light beacons over targets, modifying plane physics, or triggering weather transformations) and returns `toolResponse` frames back to Gemini in under 100ms.

5. **Session Liveness & Resilience**:
   A 15-second client keepalive ping (`clientContent: { turns: [], turn_complete: false }`) keeps the WebSocket session open throughout the 2-minute flight. If an intermittent network glitch occurs, an exponential backoff auto-reconnector automatically restores the connection without restarting the flight.

---

## 🏢 Enterprise Use Cases & Architectural Blueprint

The architecture demonstrated in **AIrborne Challenge** provides a foundational blueprint for real-time, low-latency, voice-driven enterprise applications.

```
Enterprise Client (Web / Mobile / Hardware)
   │
   ├─► Real-Time Voice Audio & Speech Recognition
   │
   ▼
Gemini Live API (Bidi WebSocket) ◄──► Real-Time Tool Calling Engine
   │
   ├─► Read/Write Tools (CRM, ERP, SQL, Telemetry DBs)
   ├─► Action Execution (Work Orders, Dispatch, Infrastructure Controls)
   │
   ▼
Low-Latency Audio Response (<300ms) + Visual UI Updates
```

### 1. Voice-Driven Field Operations & Dispatch Copilot 🛠️
* **Scenario**: Field service engineers, warehouse personnel, or utility technicians working hands-free.
* **Architecture**: The field worker speaks into their headset. Gemini Live interacts over a Bidi WebSocket connected to enterprise backend APIs (SAP, Salesforce, PostgreSQL).
* **Capabilities**:
  - *"Gemini, check inventory for transformer model X-402 and create an emergency dispatch work order for Site 12."*
  - Gemini queries inventory via read-tools, writes the work order to the database via write-tools, and confirms via low-latency voice audio in <300ms.

### 2. Interactive Voice Operations Center (NOC / SOC Assistant) 🚨
* **Scenario**: DevOps engineers and security analysts monitoring live infrastructure incidents.
* **Architecture**: Gemini Live connects to Cloud Monitoring, BigQuery, and Kubernetes APIs via WebSocket function calling.
* **Capabilities**:
  - *"Copilot, summarize the anomaly in cluster europe-west4 and scale pod deployment B by 50%."*
  - Gemini fetches live Prometheus/Cloud Logging metrics, summarizes root causes verbally, and executes Kubernetes scaling commands through approved read/write API tools.

### 3. Immersive Interactive Voice Training & Simulation Engine 🎓
* **Scenario**: Industrial equipment training, flight/marine simulators, or emergency medical response training.
* **Architecture**: 3D WebGL Web app paired with Gemini Live audio streaming and real-time environment mutators.
* **Capabilities**:
  - Real-time vocal feedback, tactical coaching, dynamic scenario adjustments (e.g., simulating engine failure, weather shifts), and automated candidate performance scoring stored in Cloud Firestore.

---

## 🎮 Game Controls

| Control | Key / Action |
|---------|--------------|
| **Pitch Control** | `W` (Pitch Down) / `S` (Pitch Up) |
| **Turn Control** | `A` (Turn Left) / `D` (Turn Right) |
| **Speed Boost** | `Shift` (Hold for Speed Boost) |
| **Brake / Slow** | `Space` (Hold to Slow Down) |
| **Radio Push-To-Talk** | `T` (Hold `T` or Mic Button to Talk) |

---

## 🛠️ Tech Stack & Libraries

- **Three.js**: 3D WebGL rendering, lighting, particle effects, chase camera physics.
- **Gemini Live API (`v1alpha` Bidi WebSocket)**: Bi-directional streaming native audio + function calling.
- **Web Audio API**: Real-time 24kHz PCM synthesis, engine pitch modulation, and cockpit radio audio filter chain.
- **Web Speech API**: Browser speech recognition for push-to-talk audio input.
- **Firebase App Hosting & Cloud Run**: Automated SPA container builds and global hosting deployment.
- **Vite & JavaScript (ES6+)**: High-performance client bundling and asset pipeline.

---

## 🚀 Local Development & Deployment

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Reksmei/AIborne-challenge.git
cd AIborne-challenge
npm install
```

### 2. Configure Environment Keys
Get a Gemini Developer API Key from **[Google AI Studio](https://aistudio.google.com/app/apikey)** and add it to `.env`:
```env
VITE_GEMINI_API_KEY=AIzaSyYourAIStudioApiKeyHere
```

### 3. Run Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Deploy to Firebase App Hosting
```bash
git add .
git commit -m "feat: deploy to Firebase App Hosting"
git push origin main
```
Firebase App Hosting automatically detects commits on `main`, runs Vite build, and deploys the production SPA container.
