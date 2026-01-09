import {
  GoogleGenAI,
  GenerateContentResponse,
  ContentListUnion,
  Content,
  PartUnion,
} from "@google/genai";
import { ImageReference, GenConfig } from "../lib/types";

export const generateImage = async (
  apiKey: string,
  prompt: string,
  references: ImageReference[],
  config: GenConfig
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const sortedRefs = [...references].sort(
    (a, b) => (a.selectedOrder || 0) - (b.selectedOrder || 0)
  );

  const parts = [{ text: prompt }] as PartUnion[];

  sortedRefs.forEach((ref) => {
    parts.push({
      inlineData: {
        data: ref.data.split(",")[1],
        mimeType: ref.mimeType,
      },
    });
  });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ parts }] as any,
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize,
        },
      },
    });

    let imageUrl = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("No image data found in response");
    }

    return imageUrl;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message?.includes("Requested entity was not found")
    ) {
      throw new Error("API_KEY_EXPIRED");
    }
    throw error;
  }
};

export const translatePrompt = async (
  apiKey: string,
  systemPrompt: string,
  content: string
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Instructions: ${systemPrompt}\n\nContent: ${content}` },
          ],
        },
      ],
    } as any);

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    return text.trim();
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
