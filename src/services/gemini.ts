import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const models = {
  text: "gemini-3.1-pro-preview",
  fast: "gemini-3-flash-preview",
  image: "gemini-2.5-flash-image",
};

export async function chatStream(message: string, history: any[] = []) {
  const chat = ai.chats.create({
    model: models.text,
    config: {
      systemInstruction: "You are OmniAI, a world-class AI assistant with Claude-level coding capabilities. You provide precise, high-quality code, deep reasoning, and helpful insights. When writing code, always use markdown blocks with language identifiers. You can also generate images if requested.",
    },
  });

  // Convert history to Gemini format if needed, but for now we'll just send the message
  // In a real app, we'd map history to { role: 'user' | 'model', parts: [{ text: ... }] }
  return chat.sendMessageStream({ message });
}

export async function generateImage(prompt: string) {
  const response = await ai.models.generateContent({
    model: models.image,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

export async function analyzeImage(prompt: string, base64Image: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: models.fast,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt },
      ],
    },
  });
  return response.text;
}
