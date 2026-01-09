import { GoogleGenAI } from "@google/genai";
import { PromptSlot } from "../lib/types";

/**
 * 调用 Gemini API 对完整提示词进行结构化拆分
 */
export async function parsePromptToSlots(
  apiKey: string,
  rawPrompt: string,
  systemPrompt: string
): Promise<PromptSlot[]> {
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Instructions: ${systemPrompt}\n\nInput Text: ${rawPrompt}`,
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // 提取 JSON 部分
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("无法解析 AI 返回的结构");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      key: string;
      label: string;
      value_cn: string;
      value_en: string;
      enabled: boolean;
    }>;

    // 确保每个插槽有 id 和完整的字段，增加字段映射鲁棒性
    return parsed.map((slot: any) => ({
      id: crypto.randomUUID(),
      key: slot.key || `slot_${crypto.randomUUID().slice(0, 4)}`,
      label: slot.label || "未命名插槽",
      value_cn: slot.value_cn || slot.content || slot.value || "",
      value_en: slot.value_en || "",
      enabled: slot.enabled ?? true,
    }));
  } catch (error) {
    console.error("Prompt parsing failed:", error);
    // 失败时返回单个插槽，包含完整原文
    return [
      {
        id: crypto.randomUUID(),
        key: "raw",
        label: "原始提示词",
        value_cn: "",
        value_en: rawPrompt,
        enabled: true,
      },
    ];
  }
}
