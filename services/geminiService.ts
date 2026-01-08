
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImageReference, GenConfig } from "../types";

export const generateImage = async (
  prompt: string,
  references: ImageReference[],
  config: GenConfig
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Sort references by their selection order
  const sortedRefs = [...references].sort((a, b) => (a.selectedOrder || 0) - (b.selectedOrder || 0));

  const parts: any[] = [{ text: prompt }];
  
  sortedRefs.forEach(ref => {
    parts.push({
      inlineData: {
        data: ref.data.split(',')[1],
        mimeType: ref.mimeType
      }
    });
  });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize
        }
      },
    });

    let imageUrl = '';
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
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_EXPIRED");
    }
    throw error;
  }
};
