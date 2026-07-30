let _onStatusChange = null;
let _onTranscript = null;
let _onToolCall = null;
let _systemPrompt = "";
let _tools = [];
let _history = [];
let _connected = false;
let _recognition = null;

function speakText(text) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[gemini] SpeechSynthesis failed:', e);
    }
  }
}

/**
 * Connect to Gemini via server-side Vertex AI proxy.
 */
export async function connect({ systemPrompt, tools, onStatusChange, onTranscript, onToolCall }) {
  _onStatusChange = onStatusChange;
  _onTranscript = onTranscript;
  _onToolCall = onToolCall;
  _systemPrompt = systemPrompt || "";
  _tools = tools || [];
  _history = [];

  onStatusChange?.("connecting");

  try {
    console.log("[gemini] Initializing Gemini session via Server Proxy...");
    // Test connection with initial system message
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "System Check - acknowledge connection with 'Airborne Control Online'.",
        systemPrompt: _systemPrompt,
        tools: _tools,
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server Proxy error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    console.log("[gemini] Connected successfully via Server Proxy:", data);
    
    if (data.text) {
      _onTranscript?.("output", data.text);
      speakText(data.text);
    }

    _connected = true;
    onStatusChange?.("connected");
    return { connected: true };
  } catch (err) {
    console.error("[gemini] Connection failed:", err);
    onStatusChange?.("error");
    throw err;
  }
}

/**
 * Start speech recognition if available.
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
        console.warn("[gemini] Mic recognition error:", event.error);
      };

      _recognition.start();
      console.log("[gemini] Continuous speech recognition started");
    } catch (e) {
      console.warn("[gemini] Could not start speech recognition:", e);
    }
  }

  return { stop: () => { try { _recognition?.stop(); } catch {} } };
}

/**
 * Send a text message to the session via Server Proxy.
 */
export async function sendText(text) {
  if (!_connected) {
    console.warn("[gemini] sendText: session not connected");
    return;
  }

  console.log("[gemini] Sending prompt via proxy:", text);
  _history.push({ role: 'user', parts: [{ text }] });

  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        systemPrompt: _systemPrompt,
        tools: _tools,
        history: _history
      })
    });

    if (!res.ok) {
      throw new Error(`Proxy error ${res.status}`);
    }

    const data = await res.json();
    console.log("[gemini] Response received:", data);

    if (data.text) {
      _history.push({ role: 'model', parts: [{ text: data.text }] });
      _onTranscript?.("output", data.text);
      speakText(data.text);
    }

    if (data.functionCalls && data.functionCalls.length > 0) {
      for (const fc of data.functionCalls) {
        console.log("[gemini] Tool call triggered:", fc.name, fc.args);
        if (_onToolCall) {
          const result = _onToolCall(fc);
          console.log("[gemini] Tool execution result:", result);
        }
      }
    }
  } catch (err) {
    console.error("[gemini] sendText error:", err);
  }
}

/**
 * Disconnect the current session.
 */
export async function disconnect() {
  if (_recognition) {
    try { _recognition.stop(); } catch {}
    _recognition = null;
  }
  _connected = false;
  _history = [];
  _onStatusChange?.("disconnected");
  _onStatusChange = null;
  _onTranscript = null;
  _onToolCall = null;
}

/**
 * Check if a session is currently active.
 */
export function isConnected() {
  return _connected;
}
