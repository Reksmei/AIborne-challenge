import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.VERTEX_AI_API_KEY || process.env.GEMINI_API_KEY;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'ai-pg-demos';

let aiClient = null;
try {
  if (apiKey) {
    aiClient = new GoogleGenAI({
      vertexAI: true,
      project: projectId,
      location: 'us-central1',
      apiKey: apiKey
    });
  } else {
    aiClient = new GoogleGenAI({
      vertexAI: true,
      project: projectId,
      location: 'us-central1'
    });
  }
} catch (e) {
  console.warn('GoogleGenAI init warning:', e.message);
}

// Health check endpoint for Cloud Run / App Hosting
app.get('/_health', (req, res) => res.status(200).send('OK'));

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.post('/api/gemini/chat', async (req, res) => {
  try {
    if (!aiClient) {
      return res.status(500).json({ error: 'AI Client not initialized' });
    }
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
      model: 'gemini-3.5-flash',
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
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('App Hosting Static Container Online');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});
