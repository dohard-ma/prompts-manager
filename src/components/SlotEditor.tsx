"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  Loader2,
  Check,
  X,
  Clipboard,
  Copy,
  ChevronDown,
  ChevronUp,
  Languages,
} from "lucide-react";
import { PromptSlot, GenConfig } from "@/lib/types";
import { translatePrompt } from "@/services/geminiService";

interface SlotEditorProps {
  slots: PromptSlot[];
  onSlotsChange: (slots: PromptSlot[]) => void;
  onParseRequest: (rawPrompt: string) => Promise<void>;
  isParsing: boolean;
  darkMode: boolean;
  apiKey: string;
  config: GenConfig;
  translationCache: Record<string, string>;
  onUpdateTranslation: (zh: string, en: string) => void;
  onPromptChange?: (prompt: string) => void; // 新增：同步提示词给父组件
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void; // 新增：通知父组件翻译是否过期
  forceTranslateSignal?: number; // 新增：父组件触发翻译的信号
}

export default function SlotEditor({
  slots,
  onSlotsChange,
  onParseRequest,
  isParsing,
  darkMode,
  apiKey,
  config,
  translationCache,
  onUpdateTranslation,
  onPromptChange,
  isTranslating,
  setIsTranslating,
  onDirtyChange,
  forceTranslateSignal,
}: SlotEditorProps) {
  const [showCnModePreview, setShowCnModePreview] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const [copied, setCopied] = useState(false);

  // 1. 计算拼好的中文文本（包含标签）
  const combinedZh = useMemo(() => {
    return (slots || [])
      .filter((s) => s.enabled && s.value_cn && s.value_cn.trim())
      .map((s) => `${s.label}: ${s.value_cn}`)
      .join("\n");
  }, [slots]);

  // 2. 翻译逻辑处理
  const [previewEn, setPreviewEn] = useState("");
  const [lastTranslatedZh, setLastTranslatedZh] = useState(""); // 记录最后一次成功翻译的中文原始内容

  const isDirty = useMemo(() => {
    if (!combinedZh) return false;
    return combinedZh !== lastTranslatedZh;
  }, [combinedZh, lastTranslatedZh]);

  // 同步脏标记给父组件
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleManualTranslate = async () => {
    if (!combinedZh || !apiKey || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translatePrompt(
        apiKey,
        config.translatePrompt,
        combinedZh
      );
      setPreviewEn(translated);
      setLastTranslatedZh(combinedZh);
      onUpdateTranslation(combinedZh, translated);
      setShowCnModePreview(false); // 翻译后自动切换到英文预览
    } catch (err) {
      console.error("Manual translation failed", err);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!combinedZh) {
      setPreviewEn("");
      return;
    }

    const cacheHit = translationCache[combinedZh];
    if (cacheHit) {
      setPreviewEn(cacheHit);
      return;
    }

    if (!config.autoTranslate || !apiKey) return;

    const performTranslation = async () => {
      setIsTranslating(true);
      try {
        const translated = await translatePrompt(
          apiKey,
          config.translatePrompt,
          combinedZh
        );
        if (active) {
          setPreviewEn(translated);
          setLastTranslatedZh(combinedZh);
          onUpdateTranslation(combinedZh, translated);
        }
      } catch (err) {
        console.error("Auto translation failed", err);
      } finally {
        if (active) setIsTranslating(false);
      }
    };

    performTranslation();

    return () => {
      active = false;
    };
  }, [combinedZh, config.autoTranslate, config.translatePrompt, apiKey]);

  // 3. 可编辑的预览内容管理
  const [editableContent, setEditableContent] = useState("");

  useEffect(() => {
    const targetValue = showCnModePreview ? combinedZh : previewEn;
    setEditableContent(targetValue);
  }, [showCnModePreview, combinedZh, previewEn]);

  // 同步内容给父组件
  useEffect(() => {
    onPromptChange?.(editableContent);
  }, [editableContent, onPromptChange]);

  // 监听父组件的强制翻译信号
  useEffect(() => {
    if (forceTranslateSignal) {
      handleManualTranslate();
    }
  }, [forceTranslateSignal]);

  const handleCopy = () => {
    if (!editableContent) return;
    navigator.clipboard.writeText(editableContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateSlot = (
    id: string,
    field: keyof PromptSlot,
    value: string | boolean
  ) => {
    onSlotsChange(
      (slots || []).map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addSlot = () => {
    const currentSlots = slots || [];
    const newSlot: PromptSlot = {
      id: crypto.randomUUID(),
      key: `slot_${currentSlots.length + 1}`,
      label: `新插槽`,
      value_cn: "",
      value_en: "",
      enabled: true,
    };
    onSlotsChange([...currentSlots, newSlot]);
  };

  const deleteSlot = (id: string) => {
    const currentSlots = slots || [];
    if (currentSlots.length <= 1) return;
    onSlotsChange(currentSlots.filter((s) => s.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const currentSlots = slots || [];
    const newSlots = [...currentSlots];
    const draggedItem = newSlots[draggedIndex];
    newSlots.splice(draggedIndex, 1);
    newSlots.splice(index, 0, draggedItem);
    onSlotsChange(newSlots);
    setDraggedIndex(index);
  };

  const handlePasteAndParse = async () => {
    if (!pasteContent.trim()) return;
    setShowPasteModal(false);
    await onParseRequest(pasteContent);
    setPasteContent("");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
      {/* Left Pane: Slot List Editor */}
      <div className="flex-1 lg:flex-[7] space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="space-y-0.5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={12} className="text-blue-500" /> 提示词插槽配置
            </h3>
            <p className="text-[8px] text-slate-400 font-medium tracking-tight">
              所有插槽的标签与内容将自动拼接并同步至右侧。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPasteModal(true)}
              disabled={isParsing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600/20 transition-all disabled:opacity-50"
            >
              {isParsing ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Clipboard size={10} />
              )}
              AI 会话分析
            </button>
            <button
              onClick={addSlot}
              className={`p-1 rounded-lg transition-all ${
                darkMode
                  ? "hover:bg-slate-800 text-slate-400"
                  : "hover:bg-slate-100 text-slate-500"
              }`}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {(slots || []).map((slot, idx) => (
            <div
              key={slot.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
                draggedIndex === idx ? "opacity-30 scale-[0.98]" : ""
              } ${
                darkMode
                  ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <div className="cursor-grab text-slate-500 hover:text-blue-500 transition-colors">
                  <GripVertical size={13} />
                </div>
                <button
                  onClick={() => updateSlot(slot.id, "enabled", !slot.enabled)}
                  className={`p-1 rounded-lg transition-all border ${
                    slot.enabled
                      ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                      : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                  }`}
                >
                  {slot.enabled ? <Check size={11} /> : <X size={11} />}
                </button>
              </div>

              {/* Editable Content */}
              <div
                className={`flex-1 flex gap-3 items-center transition-all ${
                  !slot.enabled ? "opacity-30 grayscale" : ""
                }`}
              >
                <div className="w-24 shrink-0 flex items-center">
                  <input
                    value={slot.label}
                    onChange={(e) =>
                      updateSlot(slot.id, "label", e.target.value)
                    }
                    className={`w-full bg-transparent text-[11px] font-black outline-none border-b border-dashed border-transparent focus:border-blue-500/30 transition-colors placeholder:text-slate-500 py-1 ${
                      darkMode ? "text-slate-300" : "text-slate-700"
                    }`}
                    placeholder="标题..."
                  />
                </div>

                <textarea
                  value={slot.value_cn}
                  onChange={(e) =>
                    updateSlot(slot.id, "value_cn", e.target.value)
                  }
                  rows={2}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs focus:ring-0 resize-none outline-none border transition-all min-h-[40px] flex items-center leading-normal ${
                    darkMode
                      ? "bg-slate-950/50 border-slate-800 focus:bg-slate-950 focus:border-blue-500 placeholder:text-slate-700 font-medium"
                      : "bg-slate-50 border-slate-100 focus:bg-white focus:border-blue-500 placeholder:text-slate-400 font-medium"
                  }`}
                  placeholder="中文描述..."
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteSlot(slot.id)}
                disabled={slots.length <= 1}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 transition-all disabled:opacity-0 shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane: Output Preview */}
      <div className="flex-1 lg:flex-[5] flex flex-col min-h-0">
        <div
          className={`flex flex-col rounded-3xl border shadow-2xl relative h-full overflow-hidden ${
            darkMode
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          {/* Header Controls */}
          <div className="p-4 border-b border-slate-800/10 dark:border-slate-800/50 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={12} className="text-blue-500" /> 预览与编辑
            </h3>

            <div className="flex items-center gap-2">
              {/* Controls */}
              <div className="flex items-center gap-1.5 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300/30 dark:border-slate-700/30">
                {/* Manual Translate Button */}
                <button
                  onClick={handleManualTranslate}
                  disabled={isTranslating || !isDirty}
                  title={isDirty ? "内容已更新，点击翻译" : "已是最新翻译"}
                  className={`p-1.5 rounded-lg transition-all ${
                    isDirty
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 animate-pulse"
                      : "text-slate-400 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {isTranslating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Languages size={14} />
                  )}
                </button>

                <div className="w-[1px] h-4 bg-slate-400/20 mx-0.5"></div>

                <div className="flex bg-slate-300/30 dark:bg-slate-900/50 p-0.5 rounded-lg border border-white/5 dark:border-slate-800">
                  <button
                    onClick={() => setShowCnModePreview(true)}
                    className={`px-3 py-1.5 rounded-[10px] text-[10px] font-black transition-all ${
                      showCnModePreview
                        ? "bg-white dark:bg-slate-700 text-blue-500 shadow-sm"
                        : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    中文
                  </button>
                  <div className="px-1 flex flex-col items-center opacity-40">
                    <ChevronUp size={8} className="text-blue-500" />
                    <ChevronDown size={8} className="text-slate-400" />
                  </div>
                  <button
                    onClick={() => setShowCnModePreview(false)}
                    className={`px-3 py-1.5 rounded-[10px] text-[10px] font-black transition-all ${
                      !showCnModePreview
                        ? "bg-white dark:bg-slate-700 text-blue-500 shadow-sm"
                        : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    英文
                  </button>
                </div>
              </div>

              <button
                onClick={handleCopy}
                disabled={!editableContent}
                className={`p-2 rounded-xl transition-all shadow-lg active:scale-90 flex items-center gap-2 ${
                  copied
                    ? "bg-green-500 text-white shadow-green-500/20"
                    : darkMode
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-20`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[10px] font-black uppercase tracking-wider pr-1">
                  拷贝
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1 relative group p-1">
            <textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              placeholder={
                isTranslating
                  ? "AI 深度翻译中..."
                  : "拼接结果在此预览，您可以直接修改..."
              }
              className={`w-full h-full rounded-[20px] p-5 text-sm font-bold leading-relaxed resize-none outline-none transition-all scrollbar-thin ${
                darkMode
                  ? "bg-slate-950/20 text-slate-200 placeholder:text-slate-800"
                  : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
              }`}
            />

            {isTranslating && !showCnModePreview && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-[20px] z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-blue-500" size={28} />
                  <div className="px-4 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                      Translating Flow...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`p-4 border-t border-slate-800/10 dark:border-slate-800/50 flex items-center justify-between text-[9px] font-black uppercase tracking-widest ${
              darkMode
                ? "bg-slate-950/30 text-slate-600"
                : "bg-slate-50 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-4">
              <span>
                Chars: <b className="text-blue-500">{editableContent.length}</b>
              </span>
              <span>
                Enabled:{" "}
                <b className="text-blue-500">
                  {(slots || []).filter((s) => s.enabled).length}
                </b>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  isTranslating ? "bg-amber-500 animate-pulse" : "bg-green-500"
                }`}
              />
              {showCnModePreview ? "ZH Mode" : "AI Mode"}
            </div>
          </div>
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl p-8 shadow-2xl border animate-in zoom-in-95 ${
              darkMode
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-100"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Sparkles className="text-blue-500" size={24} />
                  智能会话分析
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Extract slots from raw text
                </p>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="粘贴完整的会话记录或提示词内容..."
              className={`w-full h-48 rounded-2xl p-5 text-sm leading-relaxed resize-none outline-none border transition-all ${
                darkMode
                  ? "bg-slate-800 border-slate-700 focus:border-blue-500"
                  : "bg-slate-50 border-slate-200 focus:border-blue-500"
              }`}
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowPasteModal(false)}
                className={`flex-1 py-3 rounded-2xl font-bold text-xs transition-all border ${
                  darkMode
                    ? "border-slate-700 hover:bg-slate-800"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                取消
              </button>
              <button
                onClick={handlePasteAndParse}
                disabled={!pasteContent.trim() || isParsing}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    进行中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    开始解析
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
