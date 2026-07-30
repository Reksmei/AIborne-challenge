import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_FIREBASE_API_KEY;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'ai-pg-demos';

let aiClient;
try {
  aiClient = new GoogleGenAI({
    vertexAI: true,
    project: projectId,
    location: 'us-central1',
    apiKey: apiKey
  });
} catch (e) {
  console.warn('Failed to init GoogleGenAI with API Key, falling back to ADC:', e);
  aiClient = new GoogleGenAI({
    vertexAI: true,
    project: projectId,
    location: 'us-central1'
  });
}

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { prompt, systemPrompt, tools, history } = req.body;

    const config = {};
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }
    if (tools && tools.length > 0) {
      config.tools = [{ functionDeclarations: tools }];
    }

    const contents = history && history.length > 0 ? history : prompt;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: contents,
      config: config
    });

    const text = response.text || '';
    const functionCalls = response.functionCalls || [];

    return res.json({ text, functionCalls });
  } catch (err) {
    console.error('Gemini Server Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'Gemini proxy request failed' });
  }
});

// SPA fallback: return index.html for any route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
