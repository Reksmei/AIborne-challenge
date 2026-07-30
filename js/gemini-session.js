import {
  getLiveGenerativeModel,
  ResponseModality,
  startAudioConversation as sdkStartAudioConversation,
} from "firebase/ai";
import { googleAI } from "./firebase-config.js";

const MODEL_NAME = "gemini-2.5-flash-native-audio-preview-12-2025";

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

  const modelConfig = {
    model: MODEL_NAME,
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
    console.log(`[gemini] Connecting to Gemini Live API using ${MODEL_NAME}...`);
    liveModel = getLiveGenerativeModel(googleAI, modelConfig);
    session = await liveModel.connect();

    // Intercept receive() to tap into live audio transcription data
    const originalReceive = session.receive.bind(session);
    session.receive = function () {
      const gen = originalReceive();
      return interceptTranscriptions(gen);
    };

    console.log("[gemini] Gemini Live WebSocket session connected successfully!");
    onStatusChange?.("connected");
    return session;
  } catch (err) {
    console.error("[gemini] Gemini Live connection error:", err);
    onStatusChange?.("error");
    throw err;
  }
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
 * Send a text message to the live session.
 */
export async function sendText(text) {
  if (!session) {
    console.warn("[gemini] sendText: no session");
    return;
  }

  try {
    if (typeof session.sendClientContent === 'function') {
      await session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
      });
    } else if (typeof session.send === 'function') {
      await session.send([{ text }]);
    } else if (typeof session.sendMessage === 'function') {
      await session.sendMessage(text);
    }
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
