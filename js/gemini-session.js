const defaultApiKey = typeof atob === "function" ? atob("QVEuQWI4Uk42S1dBU3UzeDZreTh5cGtHOEVtYUhsV0l4YkJETkY5RjRGQnhNT3NTeFlpUQ==") : "";

let ws = null;
let keepAliveTimer = null;
let reconnectTimer = null;
let _explicitDisconnect = false;
let _reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

let _lastConnectArgs = null;
let _onStatusChange = null;
let _onTranscript = null;
let _onToolCall = null;
let _recognition = null;
let _audioCtx = null;

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || defaultApiKey;
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ clientContent: { turns: [], turn_complete: false } }));
      } catch (e) {
        console.warn("[gemini] Keepalive error:", e);
      }
    }
  }, 15000);
}

function playAudioPCM(base64Data, sampleRate = 24000) {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    }
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buffer = _audioCtx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);
    const source = _audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(_audioCtx.destination);
    source.start();
  } catch (e) {
    console.warn("[gemini] Error playing PCM audio:", e);
  }
}

function sanitizeToolsForLiveAPI(tools) {
  if (!tools || !Array.isArray(tools)) return undefined;
  return tools.map(tool => {
    const copy = JSON.parse(JSON.stringify(tool));
    if (copy.parameters) {
      uppercaseSchemaTypes(copy.parameters);
    }
    return copy;
  });
}

function uppercaseSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return;
  if (typeof schema.type === 'string') {
    schema.type = schema.type.toUpperCase();
  }
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      uppercaseSchemaTypes(schema.properties[key]);
    }
  }
  if (schema.items) {
    uppercaseSchemaTypes(schema.items);
  }
}

/**
 * Connect to Gemini Live API over direct WebSocket.
 */
export async function connect({ systemPrompt, tools, onStatusChange, onTranscript, onToolCall }) {
  _lastConnectArgs = { systemPrompt, tools, onStatusChange, onTranscript, onToolCall };
  _explicitDisconnect = false;
  _onStatusChange = onStatusChange;
  _onTranscript = onTranscript;
  _onToolCall = onToolCall;
  onStatusChange?.("connecting");

  const apiKey = getApiKey();
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve, reject) => {
    try {
      console.log("[gemini] Direct WebSocket connecting to Gemini Live API...");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[gemini] Direct WebSocket connected! Sending setup frame...");
        _reconnectAttempts = 0;
        const sanitizedTools = sanitizeToolsForLiveAPI(tools);
        const setupMessage = {
          setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            tools: sanitizedTools && sanitizedTools.length > 0 ? [{ function_declarations: sanitizedTools }] : undefined
          }
        };
        ws.send(JSON.stringify(setupMessage));
        startKeepAlive();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.setupComplete) {
            console.log("[gemini] setupComplete received! Live session active.");
            _onStatusChange?.("connected");
            resolve(ws);
          }

          if (data.serverContent) {
            const modelTurn = data.serverContent.modelTurn;
            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                if (part.text) {
                  _onTranscript?.("output", part.text);
                }
                if (part.inlineData && part.inlineData.data) {
                  playAudioPCM(part.inlineData.data);
                }
              }
            }
          }

          if (data.toolCall && data.toolCall.functionCalls) {
            for (const fc of data.toolCall.functionCalls) {
              console.log("[gemini] Tool call received over WS:", fc.name, fc.args);
              if (_onToolCall) {
                const result = _onToolCall(fc);
                const toolResponse = {
                  toolResponse: {
                    functionResponses: [{
                      response: result || { output: "ok" },
                      id: fc.id
                    }]
                  }
                };
                ws.send(JSON.stringify(toolResponse));
              }
            }
          }
        } catch (e) {
          console.warn("[gemini] Error processing WS message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[gemini] WebSocket error:", err);
        stopKeepAlive();
        _onStatusChange?.("error", "connection error");
        reject(err);
      };

      ws.onclose = (event) => {
        console.log(`[gemini] WebSocket closed code: ${event.code}, reason: ${event.reason}`);
        stopKeepAlive();

        if (!_explicitDisconnect && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS && _lastConnectArgs) {
          _reconnectAttempts++;
          console.log(`[gemini] Unexpected disconnect. Attempting reconnect ${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in 1.5s...`);
          _onStatusChange?.("connecting", `reconnecting (${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimer = setTimeout(() => {
            connect(_lastConnectArgs).catch(e => console.warn("[gemini] Reconnect attempt failed:", e));
          }, 1500);
        } else {
          _onStatusChange?.("disconnected", `code ${event.code}`);
        }
      };
    } catch (e) {
      console.error("[gemini] Failed to create WebSocket:", e);
      stopKeepAlive();
      _onStatusChange?.("error", e.message);
      reject(e);
    }
  });
}

/**
 * Start speech recognition or mic conversation.
 */
export async function startAudioConversation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    try {
      _recognition = new SpeechRecognition();
      _recognition.continuous = true;
      _recognition.interimResults = false;
      _recognition.lang = 'en-US';

      _recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript;
        if (transcript.trim()) {
          console.log("[gemini] Mic transcript:", transcript);
          _onTranscript?.("input", transcript);
          sendText(transcript);
        }
      };

      _recognition.onerror = (event) => {
        console.warn("[gemini] Mic error:", event.error);
      };

      _recognition.start();
    } catch (e) {
      console.warn("[gemini] Mic start error:", e);
    }
  }

  return { stop: () => { try { _recognition?.stop(); } catch {} } };
}

/**
 * Send a text message over direct WebSocket.
 */
export async function sendText(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[gemini] sendText: WebSocket not open");
    return;
  }

  try {
    const clientContent = {
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text }]
        }],
        turn_complete: true
      }
    };
    ws.send(JSON.stringify(clientContent));
  } catch (err) {
    console.warn("[gemini] sendText error:", err);
  }
}

/**
 * Disconnect the live WebSocket session.
 */
export async function disconnect() {
  _explicitDisconnect = true;
  stopKeepAlive();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (_recognition) {
    try { _recognition.stop(); } catch {}
    _recognition = null;
  }
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  _onStatusChange?.("disconnected");
}

/**
 * Check if session is active.
 */
export function isConnected() {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
