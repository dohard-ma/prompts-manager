"use client";

import React from "react";
import {
  History,
  Download,
  Maximize2,
  Clock,
  Zap,
  Trash2,
  Loader2,
} from "lucide-react";
import { GeneratedResult, AppStatus, Project } from "@/lib/types";

interface ResultGalleryProps {
  results: GeneratedResult[];
  status: AppStatus;
  projectVersions: any[]; // Used to find version names
  onDeleteResult: (resultId: string) => void;
  onLightbox: (url: string) => void;
  darkMode: boolean;
}

export default function ResultGallery({
  results,
  status,
  projectVersions,
  onDeleteResult,
  onLightbox,
  darkMode,
}: ResultGalleryProps) {
  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Visual feedback could be added via a toast if available
  };

  return (
    <section className="space-y-4 pb-24">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
        <History size={12} className="text-blue-500" /> 实验室生成成果 (Archive)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8 gap-8">
        {status === AppStatus.LOADING && (
          <div
            className={`aspect-square rounded-3xl flex flex-col items-center justify-center border overflow-hidden relative shadow-2xl transition-all ${
              darkMode
                ? "bg-slate-900/40 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-transparent to-blue-400/5 animate-pulse"></div>
            <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">
              正在渲染...
            </p>
          </div>
        )}

        {(results || []).map((result) => (
          <div
            key={result.id}
            className={`group flex flex-col border rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-blue-500/5 ${
              darkMode
                ? "bg-slate-900/80 border-slate-800 hover:border-slate-500"
                : "bg-white border-slate-200 hover:border-slate-400"
            }`}
          >
            <div
              className="relative aspect-square overflow-hidden cursor-zoom-in"
              onClick={() => onLightbox(result.imageUrl)}
            >
              <img
                src={result.imageUrl}
                alt="Result"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-3 translate-y-2 group-hover:translate-y-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(result.imageUrl, `lab-${result.id}.png`);
                  }}
                  className="bg-black/90 backdrop-blur-xl p-3 rounded-2xl text-white hover:bg-blue-600 shadow-2xl transition-all scale-90 hover:scale-100"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLightbox(result.imageUrl);
                  }}
                  className="bg-black/90 backdrop-blur-xl p-3 rounded-2xl text-white hover:bg-slate-700 shadow-2xl transition-all scale-90 hover:scale-100"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(result.promptText);
                }}
                title="点击复制完整提示词"
                className={`text-[12px] font-medium line-clamp-2 italic leading-relaxed opacity-80 cursor-pointer hover:text-blue-500 transition-colors ${
                  darkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                "{result.promptText}"
              </p>
              <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800/50">
                <div className="flex flex-wrap gap-2 items-center">
                  {(projectVersions || []).find(
                    (v) => v.id === result.promptVersionId
                  ) && (
                    <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
                      {
                        (projectVersions || []).find(
                          (v) => v.id === result.promptVersionId
                        )?.name
                      }
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                    <Clock size={10} />{" "}
                    {new Date(result.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {result.duration && (
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                      <Zap size={10} className="text-amber-500" />{" "}
                      {result.duration.toFixed(1)}s
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteResult(result.id)}
                  className="text-slate-400 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-500/5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
