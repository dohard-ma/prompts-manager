/**
 * 生成提示词哈希值，用于版本去重
 * 规则：拼接所有 value_cn，去除空格和换行，生成简单哈希
 */
export function generatePromptHash(
  slots: { value_cn: string; enabled: boolean }[]
): string {
  const enabledContent = slots
    .filter((s) => s.enabled)
    .map((s) => s.value_cn)
    .join("")
    .replace(/\s+/g, ""); // 去除所有空白字符

  // 简单哈希算法 (djb2)
  let hash = 5381;
  for (let i = 0; i < enabledContent.length; i++) {
    hash = (hash << 5) + hash + enabledContent.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 拼接所有启用的插槽，生成最终英文提示词
 */
export function buildFinalPrompt(
  slots: { value_en: string; enabled: boolean }[]
): string {
  return slots
    .filter((s) => s.enabled && s.value_en.trim())
    .map((s) => s.value_en.trim())
    .join("\n\n");
}

/**
 * 生成默认的空插槽
 */
export function createDefaultSlots(): Array<{
  id: string;
  key: string;
  label: string;
  value_cn: string;
  value_en: string;
  enabled: boolean;
}> {
  return [
    {
      id: crypto.randomUUID(),
      key: "subject",
      label: "主体描述",
      value_cn: "",
      value_en: "",
      enabled: true,
    },
    {
      id: crypto.randomUUID(),
      key: "style",
      label: "风格效果",
      value_cn: "",
      value_en: "",
      enabled: true,
    },
    {
      id: crypto.randomUUID(),
      key: "negative",
      label: "负面限制",
      value_cn: "",
      value_en: "",
      enabled: true,
    },
  ];
}
