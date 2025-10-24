import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.get("/", (req, res) => {
  res.send("🩺 AI Health Chatbot Server is Running");
});

app.post("/api/health", async (req, res) => {
  const { temperature, heartRate, spo2 } = req.body;

  if (
    temperature === undefined ||
    heartRate === undefined ||
    spo2 === undefined
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const prompt = `
    You are an AI doctor trained to provide health insights based on physiological data. You have the following information from a patient:

    - **Heart Rate**: ${heartRate} bpm
    - **SpO2 (Blood Oxygen Saturation)**: ${spo2} %
    - **Temperature**: ${temperature} °C

    Please analyze these values and provide:

    1. **Assessment** of the patient's condition based on typical health ranges:
       - Normal heart rate is between 60-100 bpm for an adult.
       - Normal SpO2 is typically 95% or higher. Below 90% is considered low and may indicate a health concern.
       - Normal body temperature is around 36.5-37.5°C.

    2. **Suggestions** based on the data:
       - If any of the values are outside the normal range, suggest what might be causing the abnormal reading and recommend possible actions the patient can take (e.g., rest, hydration, or consulting a doctor).
       - If all values are normal, provide suggestions to maintain healthy habits and prevent future health issues.

    3. **Urgency and Next Steps**:
       - If any of the values are significantly abnormal (e.g., very high heart rate, low SpO2), suggest immediate steps like seeking medical attention or emergency care.

    4. **General Advice**:
       - Include general health advice for the patient, such as improving cardiovascular health, maintaining a balanced diet, or exercising regularly if the values are normal.

    The patient is expecting accurate and actionable recommendations based on these health metrics. Make sure to keep the response clear and professional, with proper guidance on next steps.
    `;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const suggestion = aiResponse.choices?.[0]?.message?.content ?? "No suggestion generated.";

    // Send to Telegram
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `🧠 *AI Health Suggestion*\n\n${suggestion}`,
      parse_mode: "Markdown",
    });

    res.json({ success: true, suggestion });
  } catch (error) {
    console.error("Error:", error?.response?.data ?? error.message ?? error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Export the app to be used by Vercel as a serverless function
export default app;
