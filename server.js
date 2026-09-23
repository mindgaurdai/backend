import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Required on Render so express-rate-limit reads the real client IP behind proxy
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));

// Serve static frontend assets (index.html, manifest.json, sw.js) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting: Maximum 10 chat requests per minute per IP address
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please wait a minute before sending another message.' }
});

// Fetch Gemini API Key directly from Render Environment Variables
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('CRITICAL WARNING: GEMINI_API_KEY is not set in environment variables!');
}

const ai = new GoogleGenAI({ apiKey });

// Core System Instruction matching MindGuard-AI branding
const SYSTEM_INSTRUCTION = `
You are MindGuard-AI, an empathetic early-wellbeing support assistant.
Tagline: "AI that detects wellbeing changes before they become crises.[span_0](start_span)"[span_0](end_span)

Role & Behavior Guidelines:
1. Active Listening: Provide supportive, non-judgmental, and empathetic responses to users sharing stress, mood shifts, or sleep disruptions[span_1](start_span)[span_1](end_span).
2. Wellbeing Assessment: Help users reflect on daily patterns (mood, stress, sleep) and suggest manageable, actionable coping strategies[span_2](start_span)[span_2](end_span).
3. Safety Protocol: You are an AI early-support tool, NOT a diagnostic medical doctor or therapist[span_3](start_span)[span_3](end_span).
   - If a user expresses severe distress, self-harm, or suicidal ideation, respond with immediate compassionate support alongside official helpline details (e.g., 988 Suicide & Crisis Lifeline or local emergency resources).
4. Tone: Warm, supportive, clear, and grounded.
`;

// Chat API Endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { history } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload.' });
    }

    // SLIDING WINDOW: Pass only the last 10 messages to Gemini
    // Prevents payload bloating, lowers token usage, and protects speed
    const MAX_CONTEXT_MESSAGES = 10;
    const trimmedHistory = history.slice(-MAX_CONTEXT_MESSAGES);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: trimmedHistory,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return res.json({ text: response.text });
  } catch (error) {
    console.error('Gemini API Processing Error:', error);
    return res.status(500).json({ error: 'Failed to process request with MindGuard-AI engine.' });
  }
});

// Fallback route: Serves PWA entry page for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MindGuard-AI backend listening on port ${PORT}`);
});
