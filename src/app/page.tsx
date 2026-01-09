"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  History,
  Trash2,
  Check,
  ArrowRight,
  Loader2,
  FolderOpen,
  Key,
  Edit2,
  X,
  Sun,
  Moon,
  Info,
  Settings2,
  Play,
  GitCompare,
  Languages,
  Sparkles,
} from "lucide-react";
import {
  Project,
  PromptVersion,
  GeneratedResult,
  ImageReference,
  AppStatus,
  LogEntry,
  GenConfig,
  PromptSlot,
} from "@/lib/types";
import { generateImage } from "@/services/geminiService";
import { saveProjectsToDB, getProjectsFromDB } from "@/lib/db";
import { parsePromptToSlots } from "@/services/promptParser";
import {
  generatePromptHash,
  buildFinalPrompt,
  createDefaultSlots,
} from "@/lib/hashUtils";

// Components
import SlotEditor from "@/components/SlotEditor";
import VersionDiffModal from "@/components/VersionDiffModal";
import AssetLibrary from "@/components/AssetLibrary";
import ResultGallery from "@/components/ResultGallery";

const DEFAULT_LOGS: LogEntry[] = [
  {
    id: "1",
    date: "2026-01-08",
    content: "初始化 AI Creative Lab 实验室架构。",
  },
  {
    id: "2",
    date: "2026-01-08",
    content: "集成 IndexedDB，解决存储上限问题。",
  },
  { id: "3", date: "2026-01-08", content: "新增资产选择排序与明暗模式。" },
  {
    id: "4",
    date: "2026-01-08",
    content: "提示词管理系统大版本重构：插槽化、AI拆分、自动版本管理。",
  },
];

const DEFAULT_CONFIG: GenConfig = {
  imageSize: "1K",
  aspectRatio: "1:1",
  autoTranslate: false,
  translatePrompt:
    "You are a professional AI prompt translator and optimizer. Target: Stable Diffusion / Midjourney. Translate input Chinese logic into high-quality English prompts. Keep adjectives precise. Use comma-separated phrases if appropriate. No chatting, only translation result.",
  parsePrompt:
    "You are a professional prompt engineer. Analyze the provided session logs or raw text, extract key logical components (slots), and represent them as a list of slots with 'label' and 'value_cn' (the content in Chinese). Output ONLY a valid JSON array. Each object should have: label, value_cn.",
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentSlots, setCurrentSlots] = useState<PromptSlot[]>(
    createDefaultSlots()
  );
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApiKeySelected, setIsApiKeySelected] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false); // 恢复：翻译状态
  const [showDiffModal, setShowDiffModal] = useState(false); // 恢复：差异对比弹窗
  const [activePrompt, setActivePrompt] = useState(""); // 新增：追踪 SlotEditor 的当前输出
  const [isPromptDirty, setIsPromptDirty] = useState(false); // 新增：翻译是否过期
  const [showRunGuard, setShowRunGuard] = useState(false); // 新增：运行前确认弹窗
  const [translateSignal, setTranslateSignal] = useState(0); // 新增：触发翻译信号

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // Initialize data and handle theme persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    }

    const loadData = async () => {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
        setIsApiKeySelected(true);
      }

      try {
        const saved = await getProjectsFromDB();
        if (saved && saved.length > 0) {
          setProjects(saved);
          setActiveProjectId(saved[0].id);
        } else {
          const initialSlots = createDefaultSlots();
          const initial: Project = {
            id: crypto.randomUUID(),
            name: "新建实验室项目",
            versions: [
              {
                id: crypto.randomUUID(),
                name: "V1",
                slots: initialSlots,
                hash: generatePromptHash(initialSlots),
                finalPrompt: buildFinalPrompt(initialSlots),
                timestamp: Date.now(),
              },
            ],
            results: [],
            assets: [],
            config: DEFAULT_CONFIG,
          };
          setProjects([initial]);
          setActiveProjectId(initial.id);
          setCurrentSlots(initialSlots);
          setActiveVersionId(initial.versions[0].id);
          saveProjectsToDB([initial]);
        }
      } catch (e) {
        console.error("Failed to load from IndexedDB", e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (projects.length > 0) saveProjectsToDB(projects);
  }, [projects]);

  useEffect(() => {
    if (activeProject) {
      if (activeProject.versions.length > 0) {
        // If there's an active version selected, load its slots
        const version =
          (activeProject.versions.find(
            (v) => v.id === activeVersionId
          ) as any) ||
          activeProject.versions[activeProject.versions.length - 1];

        if (version.slots) {
          setCurrentSlots(version.slots);
        } else if ((version as any).prompt) {
          // Migration: Convert old prompt to a single slot
          const migratedSlots = [
            {
              id: crypto.randomUUID(),
              key: "migrated",
              label: "已迁移提示词",
              value_cn: "",
              value_en: (version as any).prompt,
              enabled: true,
            },
          ];
          setCurrentSlots(migratedSlots);
        } else {
          setCurrentSlots(createDefaultSlots());
        }
        setActiveVersionId(version.id);
      } else {
        setCurrentSlots(createDefaultSlots());
      }
    }
  }, [activeProjectId]);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem("gemini_api_key", key);
    setApiKey(key);
    setIsApiKeySelected(!!key);
    setShowApiKeyModal(false);
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `新项目 ${projects.length + 1}`,
      versions: [],
      results: [],
      assets: [],
      config: DEFAULT_CONFIG,
    };
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setCurrentSlots(createDefaultSlots());
    setEditingProjectName(true);
  };

  const updateProjectName = (newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, name: newName } : p))
    );
  };

  const updateProjectConfig = (
    key: keyof GenConfig,
    value: string | boolean
  ) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, config: { ...p.config, [key]: value } }
          : p
      )
    );
  };

  const handleParsePrompt = async (rawPrompt: string) => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    setIsParsing(true);
    try {
      const newSlots = await parsePromptToSlots(
        apiKey,
        rawPrompt,
        activeProject?.config.parsePrompt || DEFAULT_CONFIG.parsePrompt
      );
      setCurrentSlots(newSlots);
    } catch (err: any) {
      setErrorMsg("拆分失败: " + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateTranslationCache = (zh: string, en: string) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              translationCache: { ...(p.translationCache || {}), [zh]: en },
            }
          : p
      )
    );
  };

  const handleGenerate = async (force: boolean = false) => {
    if (!isApiKeySelected || !apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (!activePrompt.trim()) {
      setErrorMsg("提示词内容不能为空");
      return;
    }

    // 翻译守卫逻辑
    if (!force && isPromptDirty) {
      setShowRunGuard(true);
      return;
    }

    setShowRunGuard(false);

    setStatus(AppStatus.LOADING);
    setErrorMsg(null);
    const startPerf = performance.now();

    try {
      const selectedAssets =
        activeProject?.assets.filter((a) => a.selected) || [];
      const imageUrl = await generateImage(
        apiKey,
        activePrompt,
        selectedAssets,
        activeProject?.config || DEFAULT_CONFIG
      );
      const duration = (performance.now() - startPerf) / 1000;

      // Handle versioning
      const currentHash = generatePromptHash(currentSlots);
      let versionId = activeVersionId;

      const lastVersion =
        activeProject?.versions[activeProject.versions.length - 1];
      if (!lastVersion || lastVersion.hash !== currentHash) {
        const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          name: `V${(activeProject?.versions.length || 0) + 1}`,
          slots: [...currentSlots],
          hash: currentHash,
          finalPrompt: activePrompt,
          timestamp: Date.now(),
        };
        versionId = newVersion.id;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === activeProjectId
              ? { ...p, versions: [...p.versions, newVersion] }
              : p
          )
        );
        setActiveVersionId(newVersion.id);
      }

      const newResult: GeneratedResult = {
        id: crypto.randomUUID(),
        imageUrl,
        promptVersionId: versionId || "custom",
        promptText: activePrompt,
        timestamp: Date.now(),
        duration,
      };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId
            ? { ...p, results: [newResult, ...p.results] }
            : p
        )
      );
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      setErrorMsg(err.message || "生图失败");
      setStatus(AppStatus.ERROR);
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  const handleGenerateWithTranslate = () => {
    setTranslateSignal(Date.now());
  };

  // 监听 Dirty 状态消失，如果是因为 Guard 触发的翻译，则自动运行
  useEffect(() => {
    if (showRunGuard && !isPromptDirty && status !== AppStatus.LOADING) {
      handleGenerate(true);
    }
  }, [isPromptDirty]);

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden transition-colors duration-300 ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white">
            <X size={32} />
          </button>
          <img
            src={lightboxImage}
            alt="Fullscreen"
            className="max-w-[95%] max-h-[95%] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 cursor-zoom-out"
          />
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 border-r flex flex-col transition-colors ${
          darkMode
            ? "bg-slate-900/40 border-slate-800"
            : "bg-white border-slate-200 shadow-xl"
        }`}
      >
        <div
          className={`p-3 border-b flex items-center justify-between ${
            darkMode ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg">
              B
            </div>
            <span className="font-bold tracking-tight uppercase text-xs">
              Nano Lab Pro
            </span>
          </div>
          <button
            onClick={handleCreateProject}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            实验室项目
          </div>
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => setActiveProjectId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all group cursor-pointer ${
                activeProjectId === p.id
                  ? "bg-blue-600/15 text-blue-600 ring-1 ring-blue-500/30 font-bold"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <FolderOpen
                size={14}
                className={
                  activeProjectId === p.id ? "text-blue-500" : "text-slate-400"
                }
              />
              <span className="truncate flex-1 text-left">{p.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("删除项目？"))
                    setProjects((prev) =>
                      prev.filter((item) => item.id !== p.id)
                    );
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div
          className={`p-4 border-t ${
            darkMode
              ? "border-slate-800 bg-slate-900/60"
              : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Info size={12} className="text-blue-500" /> 更新记录
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {DEFAULT_LOGS.map((log) => (
              <div key={log.id} className="text-[11px] leading-relaxed">
                <span className="text-blue-500 font-mono font-bold mr-1">
                  {log.date}
                </span>
                <span
                  className={darkMode ? "text-slate-400" : "text-slate-600"}
                >
                  {log.content}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`p-4 border-t ${
            darkMode ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
              isApiKeySelected
                ? "bg-green-600/10 text-green-600 border border-green-600/20"
                : "bg-amber-600/10 text-amber-600 animate-pulse border border-amber-600/20"
            }`}
          >
            <Key size={14} />{" "}
            {isApiKeySelected ? "API Key 已连接" : "配置 API Key"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header
          className={`h-14 border-b flex items-center justify-between px-4 z-20 transition-colors ${
            darkMode
              ? "bg-slate-900/60 border-slate-800 backdrop-blur-md"
              : "bg-white/80 border-slate-200 backdrop-blur-md shadow-sm"
          }`}
        >
          <div className="flex items-center gap-4 flex-1">
            {editingProjectName ? (
              <input
                autoFocus
                className="bg-slate-100 dark:bg-slate-800 border-none outline-none text-lg font-bold px-2 py-1 rounded-lg w-64 ring-2 ring-blue-600"
                value={activeProject?.name || ""}
                onChange={(e) => updateProjectName(e.target.value)}
                onBlur={() => setEditingProjectName(false)}
                onKeyDown={(e) =>
                  e.key === "Enter" && setEditingProjectName(false)
                }
              />
            ) : (
              <h2
                className="text-lg font-bold cursor-pointer hover:text-blue-500 flex items-center gap-2 group"
                onClick={() => setEditingProjectName(true)}
              >
                {activeProject?.name || "新实验室项目"}{" "}
                <Edit2
                  size={14}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </h2>
            )}

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

            <div
              className={`flex items-center rounded-full px-3 py-1.5 border shadow-inner transition-colors ${
                darkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <History size={14} className="text-blue-500 mr-2" />
              <select
                className={`bg-transparent text-xs font-black outline-none cursor-pointer pr-1 uppercase transition-colors ${
                  darkMode ? "text-slate-100" : "text-slate-900"
                }`}
                value={activeVersionId || ""}
                onChange={(e) => {
                  const v = activeProject?.versions.find(
                    (ver) => ver.id === e.target.value
                  );
                  if (v) {
                    setActiveVersionId(v.id);
                    setCurrentSlots(v.slots);
                  }
                }}
              >
                {activeProject?.versions.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    className={darkMode ? "bg-slate-900" : "bg-white"}
                  >
                    {v.name}
                  </option>
                ))}
                {!activeProject?.versions.length && (
                  <option disabled className="text-slate-400">
                    无版本记录
                  </option>
                )}
              </select>
              <button
                onClick={() => setShowDiffModal(true)}
                disabled={
                  !activeProject?.versions || activeProject.versions.length < 2
                }
                className="ml-2 p-1 hover:bg-slate-700 rounded-md text-slate-400 disabled:opacity-30"
              >
                <GitCompare size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-95"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-2.5 rounded-xl transition-all border ${
                    showConfig
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 dark:border-slate-700"
                  }`}
                >
                  <Settings2 size={20} />
                </button>
                {showConfig && (
                  <div
                    className={`absolute right-0 mt-3 w-80 sm:w-[28rem] rounded-3xl p-6 shadow-2xl border z-50 animate-in slide-in-from-top-2 duration-200 ${
                      darkMode
                        ? "bg-slate-900 border-slate-800"
                        : "bg-white border-slate-100"
                    }`}
                  >
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black flex items-center gap-2">
                          <Settings2 size={16} className="text-blue-500" />{" "}
                          全局配置
                        </h4>
                        <button
                          onClick={() => setShowConfig(false)}
                          className="text-slate-500 hover:text-slate-400"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            生成分辨率
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(["1K", "2K", "4K"] as const).map((size) => (
                              <button
                                key={size}
                                onClick={() =>
                                  updateProjectConfig("imageSize", size)
                                }
                                className={`py-2 rounded-xl text-[10px] font-black border transition-all ${
                                  activeProject?.config.imageSize === size
                                    ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-700"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            画面比例
                          </div>
                          <select
                            className={`w-full text-xs py-2.5 rounded-xl px-3 outline-none border font-bold transition-all ${
                              darkMode
                                ? "bg-slate-800 border-slate-700 text-slate-300 focus:border-blue-500"
                                : "bg-slate-100 border-slate-200 text-slate-600 focus:border-blue-500"
                            }`}
                            value={activeProject?.config.aspectRatio || "1:1"}
                            onChange={(e) =>
                              updateProjectConfig("aspectRatio", e.target.value)
                            }
                          >
                            <option value="1:1">1:1 正方形</option>
                            <option value="16:9">16:9 宽屏</option>
                            <option value="9:16">9:16 竖屏</option>
                            <option value="4:3">4:3 标准</option>
                            <option value="3:4">3:4 照片</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-800/50">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              AI 翻译系统配置
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                自动翻译
                              </span>
                              <button
                                onClick={() =>
                                  updateProjectConfig(
                                    "autoTranslate",
                                    !activeProject?.config.autoTranslate
                                  )
                                }
                                className={`w-8 h-4 rounded-full transition-all relative ${
                                  activeProject?.config.autoTranslate
                                    ? "bg-blue-600"
                                    : "bg-slate-700"
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                                    activeProject?.config.autoTranslate
                                      ? "left-4.5"
                                      : "left-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                          <textarea
                            className={`w-full text-[10px] py-3 rounded-xl px-3 outline-none border h-24 resize-none leading-relaxed transition-all ${
                              darkMode
                                ? "bg-slate-800 border-slate-700 text-slate-400 focus:text-slate-200 focus:border-blue-500"
                                : "bg-slate-100 border-slate-200 text-slate-500 focus:text-slate-700 focus:border-blue-500"
                            }`}
                            value={activeProject?.config.translatePrompt || ""}
                            onChange={(e) =>
                              updateProjectConfig(
                                "translatePrompt",
                                e.target.value
                              )
                            }
                            placeholder="翻译 System Prompt..."
                          />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-800/10 dark:border-slate-800/50">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            AI 会话分析配置 (Parse Prompt)
                          </div>
                          <textarea
                            className={`w-full text-[10px] py-3 rounded-xl px-3 outline-none border h-24 resize-none leading-relaxed transition-all ${
                              darkMode
                                ? "bg-slate-800 border-slate-700 text-slate-400 focus:text-slate-200 focus:border-blue-500"
                                : "bg-slate-100 border-slate-200 text-slate-500 focus:text-slate-700 focus:border-blue-500"
                            }`}
                            value={activeProject?.config.parsePrompt || ""}
                            onChange={(e) =>
                              updateProjectConfig("parsePrompt", e.target.value)
                            }
                            placeholder="分析 System Prompt..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleGenerate()}
                disabled={status === AppStatus.LOADING}
                className="group flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all shadow-xl shadow-blue-900/30 disabled:opacity-50 active:scale-95"
              >
                {status === AppStatus.LOADING ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                {status === AppStatus.LOADING ? "渲染中..." : "RUN"}
              </button>
            </div>
          </div>
        </header>

        <div
          className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
          onClick={() => setShowConfig(false)}
        >
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm animate-in slide-in-from-top-4 shadow-lg">
              <X
                size={16}
                onClick={() => setErrorMsg(null)}
                className="cursor-pointer"
              />{" "}
              <span>{errorMsg}</span>
            </div>
          )}

          <SlotEditor
            slots={currentSlots}
            onSlotsChange={setCurrentSlots}
            onParseRequest={handleParsePrompt}
            isParsing={isParsing}
            darkMode={darkMode}
            apiKey={apiKey}
            config={activeProject?.config || DEFAULT_CONFIG}
            translationCache={activeProject?.translationCache || {}}
            onUpdateTranslation={handleUpdateTranslationCache}
            onPromptChange={setActivePrompt}
            onDirtyChange={setIsPromptDirty}
            forceTranslateSignal={translateSignal}
            isTranslating={isTranslating}
            setIsTranslating={setIsTranslating}
          />

          <AssetLibrary
            assets={activeProject?.assets || []}
            onAssetsChange={(newAssets) =>
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === activeProjectId ? { ...p, assets: newAssets } : p
                )
              )
            }
            onLightbox={setLightboxImage}
            darkMode={darkMode}
          />

          <ResultGallery
            results={activeProject?.results || []}
            status={status}
            projectVersions={activeProject?.versions || []}
            onDeleteResult={(rid) =>
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === activeProjectId
                    ? { ...p, results: p.results.filter((r) => r.id !== rid) }
                    : p
                )
              )
            }
            onLightbox={setLightboxImage}
            darkMode={darkMode}
          />
        </div>
      </main>

      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-3xl p-8 shadow-2xl border animate-in zoom-in-95 duration-200 ${
              darkMode
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-100"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black flex items-center gap-2">
                <Key className="text-blue-500" size={24} /> 配置 API Key
              </h3>
              <X
                size={20}
                className="cursor-pointer"
                onClick={() => setShowApiKeyModal(false)}
              />
            </div>
            <p
              className={`text-sm mb-6 leading-relaxed ${
                darkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              请输入您的 Gemini API Key。您的 Key 将仅保存在本地浏览器缓存中。
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="在此输入 API Key..."
                className={`w-full px-4 py-3 rounded-xl border outline-none font-mono text-sm transition-all ${
                  darkMode
                    ? "bg-slate-800 border-slate-700 text-slate-100"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              <button
                onClick={() => handleSaveApiKey(apiKey)}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-95"
              >
                保存并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiffModal && activeProject && (
        <VersionDiffModal
          versions={activeProject.versions}
          onClose={() => setShowDiffModal(false)}
          darkMode={darkMode}
        />
      )}
      {showRunGuard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div
            className={`w-full max-w-sm rounded-[32px] p-8 shadow-2xl border animate-in zoom-in-95 duration-200 ${
              darkMode
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-100"
            }`}
          >
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Languages className="text-blue-500" size={32} />
            </div>
            <h3 className="text-lg font-black text-center mb-2">
              未检测到最新翻译
            </h3>
            <p
              className={`text-sm text-center mb-8 leading-relaxed ${
                darkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              检测到中文逻辑已有更新，但翻译结果尚未同步。是否需要翻译后再运行？
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleGenerateWithTranslate}
                disabled={isTranslating}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTranslating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                翻译后运行
              </button>
              <button
                onClick={() => handleGenerate(true)}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
                  darkMode
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                直接运行 (使用当前预览内容)
              </button>
              <button
                onClick={() => setShowRunGuard(false)}
                className="w-full py-3 text-xs text-slate-500 font-medium hover:text-slate-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
