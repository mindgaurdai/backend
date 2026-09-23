import express from 'express';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();

// 1. Trust Proxy: Required on Render to accurately read client IPs for rate limiting[span_1](start_span)[span_1](end_span)
app.set('trust proxy', 1);

// 2. Security Headers: Protects against common web vulnerabilities[span_2](start_span)[span_2](end_span)
app.use(helmet());

// 3. CORS Setup: Vital for GitHub Pages to communicate with Render[span_3](start_span)[span_3](end_span)
// Replace the default value with your actual GitHub Pages URL in production via Render Environment Variables[span_4](start_span)[span_4](end_span)
const allowedOrigins = process.env.FRONTEND_URL || '*'; 
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// 4. Request Logging: Standardized Apache combined log output for Render dashboards[span_5](start_span)[span_5](end_span)
app.use(morgan('combined'));

// 5. Payload Limits: Prevent Denial of Service (DoS) via massive JSON payloads[span_6](start_span)[span_6](end_span)
app.use(express.json({ limit: '500kb' }));

// 6. Rate Limiting: Maximum 15 chat requests per minute per IP address[span_7](start_span)[span_7](end_span)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please pause for a moment before continuing.' }
});

// 7. MULTI-KEY LOAD BALANCER INITIALIZATION
// Load all available keys from environment variables and filter out empty ones
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4
].filter(Boolean);

// Fail fast if the environment is completely misconfigured[span_8](start_span)[span_8](end_span)
if (apiKeys.length === 0) {
  console.error('CRITICAL ERROR: No GEMINI_API_KEY environment variables found.');
  process.exit(1); // Stop the server immediately if there is no API key[span_9](start_span)[span_9](end_span)
}

// Initialize a pool of GoogleGenAI clients for each available key
const aiClients = apiKeys.map(key => new GoogleGenAI({ apiKey: key }));
let currentClientIndex = 0;

// Core System Instruction matching MindGuard-AI branding[span_10](start_span)[span_10](end_span)
// ENHANCED: Deep listening, questioning, and actionable psychological relief
const SYSTEM_INSTRUCTION = `
You are MindGuard-AI, an empathetic early-wellbeing support assistant.
Tagline: "AI that detects wellbeing changes before they become crises."

Role & Behavior Guidelines:
1. Active & Deep Listening: Always start by validating the user's feelings. Make them feel heard and understood before offering solutions. 
2. Ask Gentle Questions: Do not just lecture. Ask one thoughtful, open-ended question per response to help the user unpack their feelings, understand the root of their stress, or reflect on their depression.
3. Actionable Relief: Provide highly practical, immediate strategies to get out of acute stress and manage depressive episodes (e.g., 5-4-3-2-1 grounding, box breathing, behavioral activation, cognitive reframing).
4. Wellbeing Assessment: Help users reflect on daily patterns (mood, stress, sleep) and suggest manageable, actionable coping strategies[span_11](start_span)[span_11](end_span).
5. Safety Protocol: You are an AI early-support tool, NOT a diagnostic medical doctor or therapist[span_12](start_span)[span_12](end_span).
   - If a user expresses severe distress, self-harm, or suicidal ideation, respond with immediate compassionate support alongside official helpline details (e.g., 988 Suicide & Crisis Lifeline or local emergency resources)[span_13](start_span)[span_13](end_span).
6. Tone: Warm, conversational, highly supportive, clear, and grounded[span_14](start_span)[span_14](end_span). Act as a non-judgmental confidant.
`;

// Helper function to execute requests with automatic key rotation
async function generateContentWithFailover(trimmedHistory) {
  let attempts = 0;
  const maxAttempts = aiClients.length;
  let lastError = null;

  while (attempts < maxAttempts) {
    const currentAiClient = aiClients[currentClientIndex];
    
    try {
      const response = await currentAiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: trimmedHistory,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });
      return response.text;
    } catch (error) {
      lastError = error;
      const statusCode = error.status || error.response?.status;

      // Failover trigger: Rate Limit (429) or Server Error (500+)
      if (statusCode === 429 || statusCode >= 500) {
        console.warn(`[Load Balancer] Key ${currentClientIndex + 1} failed with status ${statusCode}. Rotating to next key...`);
        // Move to the next key and loop back to the start if at the end of the array
        currentClientIndex = (currentClientIndex + 1) % aiClients.length;
        attempts++;
      } else {
        // Stop retrying if it's a 400 Bad Request (invalid history format) or 401 Unauthorized
        console.error(`[Load Balancer] Unrecoverable Gemini API Error:`, error.message);
        throw error;
      }
    }
  }

  console.error(`[Load Balancer] All ${maxAttempts} Gemini API keys failed.`);
  throw new Error("All API keys are currently rate-limited or unavailable.", { cause: lastError });
}

// 8. Health Check Route: Render uses this to ensure your server is alive[span_15](start_span)[span_15](end_span)
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

    // SLIDING WINDOW: Pass only the last 10 messages to Gemini[span_16](start_span)[span_16](end_span)
    // Prevents payload bloating, lowers token usage, and protects speed[span_17](start_span)[span_17](end_span)
    const MAX_CONTEXT_MESSAGES = 10;
    const trimmedHistory = history.slice(-MAX_CONTEXT_MESSAGES);

    // Call the failover load balancer instead of a single static client
    const aiResponseText = await generateContentWithFailover(trimmedHistory);

    return res.json({ text: aiResponseText });
  } catch (error) {
    console.error('Gemini API Processing Error:', error.message || error);
    
    // Check for specific Google AI quota errors[span_18](start_span)[span_18](end_span)
    if (error.status === 429 || error.message.includes("rate-limited")) {
      return res.status(429).json({ error: 'MindGuard-AI is currently experiencing exceptionally high traffic. Please take a deep breath and try again in a few minutes.' });
    }
    
    return res.status(500).json({ error: 'Failed to process request with MindGuard-AI engine.' });
  }
});

// 10. Global Error Handler for unhandled middleware issues[span_19](start_span)[span_19](end_span)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MindGuard-AI API listening on port ${PORT} with ${apiKeys.length} active API keys in rotation`);
});
