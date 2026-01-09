"use client";

import React, { useState } from "react";
import { X, GitCompare, ChevronDown } from "lucide-react";
import { PromptVersion } from "@/lib/types";

interface VersionDiffModalProps {
  versions: PromptVersion[];
  onClose: () => void;
  darkMode: boolean;
}

export default function VersionDiffModal({
  versions,
  onClose,
  darkMode,
}: VersionDiffModalProps) {
  const [leftVersionId, setLeftVersionId] = useState<string>(
    versions.length > 1
      ? versions[versions.length - 2].id
      : versions[0]?.id || ""
  );
  const [rightVersionId, setRightVersionId] = useState<string>(
    versions[versions.length - 1]?.id || ""
  );

  const leftVersion = versions.find((v) => v.id === leftVersionId);
  const rightVersion = versions.find((v) => v.id === rightVersionId);

  // 合并两个版本的所有 slot key
  const allSlotKeys = new Set<string>();
  (leftVersion?.slots || []).forEach((s) => allSlotKeys.add(s.key));
  (rightVersion?.slots || []).forEach((s) => allSlotKeys.add(s.key));

  const getSlotByKey = (version: PromptVersion | undefined, key: string) => {
    return (version?.slots || []).find((s) => s.key === key);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl border animate-in zoom-in-95 flex flex-col ${
          darkMode
            ? "bg-slate-900 border-slate-800"
            : "bg-white border-slate-100"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            darkMode ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <GitCompare className="text-blue-500" size={20} />
            版本对比
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Version Selectors */}
        <div
          className={`flex items-center gap-4 px-6 py-3 border-b ${
            darkMode
              ? "border-slate-800 bg-slate-900/50"
              : "border-slate-100 bg-slate-50"
          }`}
        >
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
              版本 A
            </label>
            <div className="relative">
              <select
                value={leftVersionId}
                onChange={(e) => setLeftVersionId(e.target.value)}
                className={`w-full py-2 px-3 pr-8 rounded-lg text-sm font-bold appearance-none outline-none cursor-pointer ${
                  darkMode
                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                    : "bg-white text-slate-900 border border-slate-200"
                }`}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} - {new Date(v.timestamp).toLocaleString()}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <div className="text-slate-400 font-bold text-lg">VS</div>

          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
              版本 B
            </label>
            <div className="relative">
              <select
                value={rightVersionId}
                onChange={(e) => setRightVersionId(e.target.value)}
                className={`w-full py-2 px-3 pr-8 rounded-lg text-sm font-bold appearance-none outline-none cursor-pointer ${
                  darkMode
                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                    : "bg-white text-slate-900 border border-slate-200"
                }`}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} - {new Date(v.timestamp).toLocaleString()}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Array.from(allSlotKeys).map((key) => {
            const leftSlot = getSlotByKey(leftVersion, key);
            const rightSlot = getSlotByKey(rightVersion, key);
            const isDifferent =
              leftSlot?.value_en !== rightSlot?.value_en ||
              leftSlot?.value_cn !== rightSlot?.value_cn;

            return (
              <div
                key={key}
                className={`rounded-xl border overflow-hidden ${
                  isDifferent
                    ? "border-amber-500/50"
                    : darkMode
                    ? "border-slate-800"
                    : "border-slate-200"
                }`}
              >
                <div
                  className={`flex items-center justify-between px-4 py-2 ${
                    isDifferent
                      ? "bg-amber-500/10"
                      : darkMode
                      ? "bg-slate-800/50"
                      : "bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-bold">
                    {leftSlot?.label || rightSlot?.label || key}
                  </span>
                  {isDifferent && (
                    <span className="text-[10px] font-bold text-amber-500 uppercase">
                      已变更
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 divide-x dark:divide-slate-800">
                  <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                      版本 A
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        !leftSlot ? "text-slate-400 italic" : ""
                      }`}
                    >
                      {leftSlot?.value_en || "(空)"}
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                      版本 B
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        !rightSlot ? "text-slate-400 italic" : ""
                      }`}
                    >
                      {rightSlot?.value_en || "(空)"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {allSlotKeys.size === 0 && (
            <div className="text-center py-12 text-slate-400">
              没有可对比的插槽内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
