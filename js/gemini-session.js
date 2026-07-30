import {
  getLiveGenerativeModel,
  ResponseModality,
  startAudioConversation as sdkStartAudioConversation,
} from "firebase/ai";
import { ai } from "./firebase-config.js";

const CANDIDATE_MODELS = [
  "gemini-live-2.5-flash-native-audio",
  "gemini-live-2.5-flash-preview-native-audio-09-2025",
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-2.0-flash-exp"
];

let session = null;
let liveModel = null;
let audioConversationController = null;
let _onStatusChange = null;
let _onTranscript = null;
let _onToolCall = null;

/**
 * Connect to Gemini Live with a system prompt and optional tools.
 */
export async function connect({ systemPrompt, tools, onStatusChange, onTranscript, onToolCall }) {
  _onStatusChange = onStatusChange;
  _onTranscript = onTranscript;
  _onToolCall = onToolCall;
  onStatusChange?.("connecting");

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    const modelConfig = {
      model: modelName,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO],
        outputAudioTranscription: {},
      },
    };

    if (tools && tools.length > 0) {
      modelConfig.tools = [{ functionDeclarations: tools }];
    }

    try {
      console.log(`[gemini] Attempting connection with model: ${modelName}`);
      liveModel = getLiveGenerativeModel(ai, modelConfig);
      session = await liveModel.connect();

      // Intercept receive() to tap into transcription data
      const originalReceive = session.receive.bind(session);
      session.receive = function () {
        const gen = originalReceive();
        return interceptTranscriptions(gen);
      };

      console.log(`[gemini] Session connected successfully using ${modelName}`);
      onStatusChange?.("connected");
      return session;
    } catch (err) {
      console.warn(`[gemini] Failed to connect using ${modelName}:`, err);
      lastError = err;
    }
  }

  console.error("[gemini] All candidate models failed to connect:", lastError);
  onStatusChange?.("error");
  throw lastError;
}

/**
 * Wraps the async generator to extract transcription text.
 */
async function* interceptTranscriptions(generator) {
  for await (const message of generator) {
    if (message.outputTranscription?.text) {
      _onTranscript?.("output", message.outputTranscription.text);
    }
    if (message.inputTranscription?.text) {
      _onTranscript?.("input", message.inputTranscription.text);
    }
    yield message;
  }
}

/**
 * Start bidirectional audio conversation with tool call handling.
 */
export async function startAudioConversation() {
  if (!session) throw new Error("No active session");

  const options = {};

  if (_onToolCall) {
    options.functionCallingHandler = async (functionCalls) => {
      const responses = [];
      for (const fc of functionCalls) {
        const result = _onToolCall(fc);
        responses.push({
          name: fc.name,
          response: result,
        });
      }
      return responses;
    };
  }

  audioConversationController = await sdkStartAudioConversation(session, options);
  return audioConversationController;
}

/**
 * Send a text message to the session.
 */
export async function sendText(text) {
  if (!session) {
    console.warn("[gemini] sendText: no session");
    return;
  }
  console.log("[gemini] sendText called with:", text.substring(0, 60) + "...");
  console.log("[gemini] session.send:", typeof session.send);
  console.log("[gemini] session.sendClientContent:", typeof session.sendClientContent);
  console.log("[gemini] session.sendMessage:", typeof session.sendMessage);

  try {
    // Try sendClientContent first (standard Live API)
    if (typeof session.sendClientContent === 'function') {
      console.log("[gemini] Using session.sendClientContent");
      await session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
      });
    }
    // Try send() as fallback — expects iterable of parts
    else if (typeof session.send === 'function') {
      console.log("[gemini] Using session.send");
      console.log("[gemini] Trying send with array of parts...");
      await session.send([{ text }]);
    }
    // Try sendMessage as fallback
    else if (typeof session.sendMessage === 'function') {
      console.log("[gemini] Using session.sendMessage");
      await session.sendMessage(text);
    }
    else {
      console.warn("[gemini] No known send method found on session");
    }
    console.log("[gemini] sendText succeeded");
  } catch (err) {
    console.warn("[gemini] sendText failed:", err);
  }
}

/**
 * Disconnect the current session.
 */
export async function disconnect() {
  if (audioConversationController) {
    try { await audioConversationController.stop(); } catch { /* ignore */ }
    audioConversationController = null;
  }
  if (session) {
    try { await session.close(); } catch { /* ignore */ }
    session = null;
  }
  liveModel = null;
  _onStatusChange?.("disconnected");
  _onStatusChange = null;
  _onTranscript = null;
  _onToolCall = null;
}

/**
 * Check if a session is currently active.
 */
export function isConnected() {
  return session !== null;
}
