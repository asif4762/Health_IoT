import express from 'express';
import bodyParser from 'body-parser';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(bodyParser.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Telegram Bot Tokens
const USER_BOT_TOKEN = process.env.USER_BOT_TOKEN;
const EMERGENCY_BOT_TOKEN = process.env.EMERGENCY_BOT_TOKEN;

// Telegram Chat IDs
const USER_CHAT_ID = process.env.USER_CHAT_ID;
const EMERGENCY_CHAT_ID = process.env.EMERGENCY_CHAT_ID;

// Helper to send message via Telegram
async function sendTelegramMessage(botToken, chatId, message) {
  if (!botToken || !chatId) {
    console.warn('⚠️ Telegram bot token or chat ID missing. Cannot send message.');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, { chat_id: chatId, text: message });
    console.log(`✅ Message sent to chat ID ${chatId}`);
  } catch (err) {
    console.error('❌ Telegram send error:', err.response?.data || err.message);
  }
}

// POST endpoint to receive health data
app.post('/api/data', async (req, res) => {
  const { heartRate, spo2, temperature } = req.body;

  if (!heartRate || !spo2 || !temperature) {
    return res.status(400).json({ message: 'Invalid or missing data' });
  }

  console.log('📩 Received data:', { heartRate, spo2, temperature });

  // OpenAI prompt
  const prompt = `
You are an AI doctor analyzing a patient's health:

Heart Rate: ${heartRate} bpm
SpO2: ${spo2} %
Temperature: ${temperature} °C

Provide a clear analysis, suggestions, and whether this is an emergency.
`;

  try {
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const healthRecommendation = gptResponse.choices[0].message.content;
    console.log('🧠 AI Recommendation:', healthRecommendation);

    // Send AI analysis to user
    await sendTelegramMessage(USER_BOT_TOKEN, USER_CHAT_ID, healthRecommendation);

    // Check for emergency conditions
    if (heartRate < 50 || heartRate > 120 || spo2 < 90 || temperature > 38 || temperature < 35) {
      const emergencyMessage = `🚨 EMERGENCY ALERT 🚨
Abnormal readings detected:
Heart Rate: ${heartRate}
SpO2: ${spo2}
Temperature: ${temperature}
Immediate attention required!`;

      await sendTelegramMessage(EMERGENCY_BOT_TOKEN, EMERGENCY_CHAT_ID, emergencyMessage);
    }

    res.status(200).json({ message: 'Data analyzed and sent to Telegram!', recommendation: healthRecommendation });
  } catch (err) {
    console.error('❌ Error processing data:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// app.get('/', (req, res) => {
//   res.send('✅ IoT Health Monitoring Backend with Telegram is running');
// });

// app.listen(port, () => {
//   console.log(`🚀 Backend running at http://localhost:${port}`);
// });
export default app;