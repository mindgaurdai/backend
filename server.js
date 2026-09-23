import express from 'express';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();

// 1. Trust Proxy: Required on Render to accurately read client IPs for rate limiting
app.set('trust proxy', 1);

// 2. Security Headers: Protects against common web vulnerabilities
app.use(helmet());

// 3. CORS Setup: Vital for GitHub Pages to communicate with Render
// Replace the default value with your actual GitHub Pages URL in production via Render Environment Variables
const allowedOrigins = process.env.FRONTEND_URL || '*'; 
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// 4. Request Logging: Standardized Apache combined log output for Render dashboards
app.use(morgan('combined'));

// 5. Payload Limits: Prevent Denial of Service (DoS) via massive JSON payloads
app.use(express.json({ limit: '500kb' }));

// 6. Rate Limiting: Maximum 15 chat requests per minute per IP address
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please pause for a moment before continuing.' }
});

// 7. API Key Validation: Fail fast if the environment is misconfigured
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('CRITICAL ERROR: GEMINI_API_KEY environment variable is missing.');
  process.exit(1); // Stop the server immediately if there is no API key
}

const ai = new GoogleGenAI({ apiKey });

// Core System Instruction matching MindGuard-AI branding[span_0](start_span)[span_0](end_span)
const SYSTEM_INSTRUCTION = `
You are MindGuard-AI, an empathetic early-wellbeing support assistant.
Tagline: "AI that detects wellbeing changes before they become crises."

Role & Behavior Guidelines:
1. Active Listening: Provide supportive, non-judgmental, and empathetic responses to users sharing stress, mood shifts, or sleep disruptions.
2. Wellbeing Assessment: Help users reflect on daily patterns (mood, stress, sleep) and suggest manageable, actionable coping strategies.
3. Safety Protocol: You are an AI early-support tool, NOT a diagnostic medical doctor or therapist.
   - If a user expresses severe distress, self-harm, or suicidal ideation, respond with immediate compassionate support alongside official helpline details (e.g., 988 Suicide & Crisis Lifeline or local emergency resources).
4. Tone: Warm, supportive, clear, and grounded.
`;

// 8. Health Check Route: Render uses this to ensure your server is alive
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'MindGuard-AI API' });
});

// 9. Chat API Endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { history } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing message payload.' });
    }

    // SLIDING WINDOW: Pass only the last 10 messages to Gemini[span_1](start_span)[span_1](end_span)
    // Prevents payload bloating, lowers token usage, and protects speed[span_2](start_span)[span_2](end_span)
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
    console.error('Gemini API Processing Error:', error.message || error);
    
    // Check for specific Google AI quota errors
    if (error.status === 429) {
      return res.status(429).json({ error: 'MindGuard-AI is currently experiencing high traffic. Please try again in a few minutes.' });
    }
    
    return res.status(500).json({ error: 'Failed to process request with MindGuard-AI engine.' });
  }
});

// 10. Global Error Handler for unhandled middleware issues
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MindGuard-AI API listening on port ${PORT}`);
});
