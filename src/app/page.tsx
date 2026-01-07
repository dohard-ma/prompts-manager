"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { IconHelper } from "@/components/IconHelper";

// --- Types ---
interface Project {
  id: string;
  name: string;
  createdAt: string;
  genPrompt?: string;
}

interface Version {
  id: string;
  projectId: string;
  title: string;
  enPrompt: string;
  zhPrompt: string;
  reason: string;
  imperfection: string;
  createdAt: string;
}

interface GenTask {
  id: string;
  projectId: string;
  source: string | null;
  sourceUrl: string;
  status: "ready" | "running" | "success" | "error";
  result: string | null;
  error: string | null;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<"prompts" | "generator">("prompts");
  const [promptProjects, setPromptProjects] = useState<Project[]>([]);
  const [genProjects, setGenProjects] = useState<Project[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [genTasks, setGenTasks] = useState<GenTask[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form States
  const [inputEn, setInputEn] = useState("");
  const [inputThoughts, setInputThoughts] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputReason, setInputReason] = useState("");
  const [inputImperfection, setInputImperfection] = useState("");
  const [inputZh, setInputZh] = useState("");

  // Key Selection State
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isSearchingKeys, setIsSearchingKeys] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Storage ---
  useEffect(() => {
    const saved = localStorage.getItem("prompt_lab_app_data");
    if (saved) {
      const data = JSON.parse(saved);
      setPromptProjects(data.promptProjects || []);
      setGenProjects(data.genProjects || []);
      setActivePromptId(data.activePromptId || null);
      setActiveGenId(data.activeGenId || null);
      setVersions(data.versions || []);
      setGenTasks(data.genTasks || []);
    } else {
      const defaultPrompt = {
        id: "pp1",
        name: "默认文案项目",
        createdAt: new Date().toISOString(),
      };
      const defaultGen = {
        id: "gp1",
        name: "默认打版项目",
        createdAt: new Date().toISOString(),
        genPrompt: "Professional studio lighting.",
      };
      setPromptProjects([defaultPrompt]);
      setGenProjects([defaultGen]);
      setActivePromptId(defaultPrompt.id);
      setActiveGenId(defaultGen.id);
    }
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  const save = useCallback(() => {
    const data = {
      promptProjects,
      genProjects,
      activePromptId,
      activeGenId,
      versions,
      genTasks,
    };
    localStorage.setItem("prompt_lab_app_data", JSON.stringify(data));
    localStorage.setItem("gemini_api_key", apiKey);
  }, [
    promptProjects,
    genProjects,
    activePromptId,
    activeGenId,
    versions,
    genTasks,
    apiKey,
  ]);

  useEffect(() => {
    save();
  }, [save]);

  // --- AI Logic ---
  const fetchWithRetry = async (
    url: string,
    options: any,
    retries = 5,
    backoff = 1000
  ): Promise<any> => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `API Error`);
      }
      return await res.json();
    } catch (err: any) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const handleAIAnalyze = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    if (!inputEn && !inputThoughts) return;
    setIsAnalyzing(true);
    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `Prompt: ${inputEn}\nThoughts: ${inputThoughts}` },
                ],
              },
            ],
            systemInstruction: {
              parts: [
                {
                  text: "Analyze iteration and return a single JSON object (NOT an array) with these fields: title, reason, imperfection, zhPrompt. Use Chinese for all fields.",
                },
              ],
            },
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      let text = data.candidates[0].content.parts[0].text;
      // Remove markdown code blocks if present
      text = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      let ai = JSON.parse(text);

      // If the AI returns an array, take the first element
      if (Array.isArray(ai)) {
        ai = ai[0];
      }

      setInputTitle(ai.title || "");
      setInputReason(ai.reason || "");
      setInputImperfection(ai.imperfection || "");
      setInputZh(ai.zhPrompt || "");
    } catch (e) {
      alert("AI 分析异常");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveVersion = () => {
    if (!inputTitle || !inputEn || !activePromptId) return;
    const newV: Version = {
      id: "v_" + Date.now(),
      projectId: activePromptId,
      title: inputTitle,
      enPrompt: inputEn,
      zhPrompt: inputZh,
      reason: inputReason,
      imperfection: inputImperfection,
      createdAt: new Date().toISOString(),
    };
    setVersions([newV, ...versions]);
    setIsAdding(false);
    // Clear form
    setInputEn("");
    setInputThoughts("");
    setInputTitle("");
    setInputReason("");
    setInputImperfection("");
    setInputZh("");
  };

  const deleteVersion = (id: string) => {
    if (confirm("确定要删除这条记录吗？")) {
      setVersions(versions.filter((v) => v.id !== id));
    }
  };

  const copyEn = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    const btnText = document.getElementById(`copy-text-${id}`);
    if (btnText) {
      const old = btnText.innerText;
      btnText.innerText = "Copied!";
      setTimeout(() => (btnText.innerText = old), 2000);
    }
  };

  // --- Generator Logic ---
  const addImageTask = (base64: string | null, previewUrl: string) => {
    if (!activeGenId) return;
    const newTask: GenTask = {
      id: "t_" + Date.now() + Math.random().toString(36).slice(2),
      projectId: activeGenId,
      source: base64,
      sourceUrl: previewUrl,
      status: "ready",
      result: null,
      error: null,
    };
    setGenTasks([...genTasks, newTask]);
  };

  const removeTask = (id: string) => {
    setGenTasks(genTasks.filter((t) => t.id !== id));
  };

  const runSingleTask = async (id: string) => {
    const task = genTasks.find((t) => t.id === id);
    if (!task || !apiKey) return;
    const curP = genProjects.find((p) => p.id === task.projectId);

    // Update status to running
    setGenTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "running" } : t))
    );

    try {
      const body: any = {
        contents: [
          {
            parts: [
              {
                text: `Task: Re-render product maintaining shape. Style: ${
                  curP?.genPrompt || "Professional"
                }`,
              },
            ],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      };

      if (task.source) {
        body.contents[0].parts.push({
          inlineData: { mimeType: "image/png", data: task.source },
        });
      } else {
        // If it's a URL, we might need a different approach or just skip for now
        // For simplicity, prototype used base64.
        throw new Error(
          "Only local images/pasted images are supported in this demo."
        );
      }

      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const imgPart = data.candidates?.[0]?.content?.parts?.find(
        (p: any) =>
          p.inlineData ||
          (p.text &&
            (p.text.includes("data:image") ||
              /^[A-Za-z0-9+/=]+$/.test(p.text.trim())))
      );
      if (imgPart) {
        let resultData = "";
        if (imgPart.inlineData) {
          resultData = `data:image/png;base64,${imgPart.inlineData.data}`;
        } else if (imgPart.text) {
          const trimmedText = imgPart.text.trim();
          // Case 1: text contains a full data URI
          const match = trimmedText.match(/data:image\/[^;]+;base64,[^"'\s$]+/);
          if (match) {
            resultData = match[0];
          }
          // Case 2: text is just the base64 string
          else if (/^[A-Za-z0-9+/=]+$/.test(trimmedText)) {
            resultData = `data:image/png;base64,${trimmedText}`;
          }
        }

        if (resultData) {
          setGenTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: "success",
                    result: resultData,
                  }
                : t
            )
          );
        } else {
          throw new Error("No image data found in AI response.");
        }
      } else {
        throw new Error("AI did not return an image.");
      }
    } catch (e: any) {
      setGenTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "error", error: e.message } : t
        )
      );
    }
  };

  const runPendingTasks = async () => {
    const tasks = genTasks.filter(
      (t) =>
        t.projectId === activeGenId &&
        (t.status === "ready" || t.status === "error")
    );
    for (const t of tasks) {
      await runSingleTask(t.id);
    }
  };

  const downloadImg = (result: string) => {
    const l = document.createElement("a");
    l.href = result;
    l.download = `rendered_${Date.now()}.png`;
    l.click();
  };

  const addUrlTask = () => {
    const url = prompt("请输入图片外链 URL:");
    if (url) addImageTask(null, url);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (view !== "generator") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result as string;
            addImageTask(result.split(",")[1], result);
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [view, activeGenId, genTasks]);

  // --- Google Drive Logic for Key Selection ---
  const searchKeysInDrive = async () => {
    if (!session?.accessToken) return;
    setIsSearchingKeys(true);
    try {
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/json' or name contains 'key' or name contains 'config'&fields=files(id, name, mimeType)`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );
      const data = await resp.json();
      setDriveFiles(data.files || []);
    } catch (e) {
      console.error("Search error", e);
    } finally {
      setIsSearchingKeys(false);
    }
  };

  const selectKeyFile = async (fileId: string) => {
    if (!session?.accessToken) return;
    try {
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );
      const content = await resp.json();
      if (content.gemini_api_key) {
        setApiKey(content.gemini_api_key);
        alert("API Key 已从 Google Drive 同步");
      } else {
        alert("未在文件中找到 gemini_api_key");
      }
    } catch (e) {
      alert("读取文件失败");
    }
  };

  useEffect(() => {
    if (status === "authenticated" && !apiKey) {
      searchKeysInDrive();
    }
  }, [status, apiKey]);

  // --- Rendering Helpers ---
  const isPrompt = view === "prompts";
  const curProjects = isPrompt ? promptProjects : genProjects;
  const actId = isPrompt ? activePromptId : activeGenId;
  const curProj = curProjects.find((p) => p.id === actId);
  const filteredVersions = versions.filter(
    (v) => v.projectId === activePromptId
  );
  const currentGenTasks = genTasks.filter((t) => t.projectId === activeGenId);

  return (
    <div id="app" className="min-h-screen pb-20">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <IconHelper name="beaker" className="text-white" />
            </div>
            <h1 className="font-black text-lg tracking-tight italic uppercase">
              AI Creative Lab
            </h1>
          </div>

          <div className="flex items-center gap-6 h-20">
            <button
              onClick={() => {
                setView("prompts");
                setIsAdding(false);
              }}
              className={`h-full px-2 font-bold text-sm transition-all border-b-3 ${
                view === "prompts"
                  ? "active-tab"
                  : "border-transparent text-slate-400"
              }`}
            >
              提示词实验室
            </button>
            <button
              onClick={() => {
                setView("generator");
                setIsAdding(false);
              }}
              className={`h-full px-2 font-bold text-sm transition-all border-b-3 ${
                view === "generator"
                  ? "active-tab"
                  : "border-transparent text-slate-400"
              }`}
            >
              批量重绘打版
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Google 登录状态 */}
          {status === "loading" ? (
            <div className="px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-400">
              Loading...
            </div>
          ) : session ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-slate-500">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-[9px] font-bold text-rose-500 hover:underline"
                >
                  退出
                </button>
              </div>
              {session.user?.image && (
                <img
                  src={session.user.image}
                  className="w-8 h-8 rounded-full border border-slate-200"
                  alt="avatar"
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm"
            >
              <IconHelper name="google" size={14} className="text-indigo-600" />
              <span>Google 登录</span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(true)}
            className="p-3 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
          >
            <IconHelper name="settings" size={20} />
          </button>

          {isPrompt && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <IconHelper name={isAdding ? "x" : "plus"} size={18} />
              <span className="hidden sm:inline">
                {isAdding ? "取消" : "记录迭代"}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ==================== 项目导航 ==================== */}
      <div className="max-w-6xl mx-auto px-6 pt-10 flex items-center justify-between">
        <div className="flex items-center gap-2 opacity-40">
          <IconHelper name="grid" size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest italic">
            Scene Context
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
          >
            <IconHelper name="folder" size={14} className="text-indigo-600" />
            <span>{curProj ? curProj.name : "加载场景..."}</span>
            <IconHelper name="chevronDown" size={12} />
          </button>

          {showProjectMenu && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[60]">
              <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-2">
                切换 {isPrompt ? "提示词" : "打版"} 项目
              </div>
              <div className="max-h-60 overflow-y-auto">
                {curProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (isPrompt) setActivePromptId(p.id);
                      else setActiveGenId(p.id);
                      setShowProjectMenu(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between ${
                      actId === p.id
                        ? "bg-indigo-50 text-indigo-600"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {p.name}{" "}
                    {actId === p.id && <IconHelper name="check" size={14} />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowProjectModal(true);
                  setShowProjectMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 mt-2 border-t border-slate-50 pt-2 flex items-center gap-2"
              >
                <IconHelper name="plus" size={12} /> 创建新场景项目
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 提示词实验室视图 ==================== */}
      {isPrompt && (
        <main className="max-w-5xl mx-auto px-6 py-6">
          {isAdding && (
            <div className="mb-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center text-white">
                <h2 className="font-bold flex items-center gap-2">
                  <IconHelper name="sparkles" size={22} /> 迭代分析录入
                </h2>
                <button
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing}
                  className="bg-white text-indigo-600 px-5 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                >
                  <IconHelper name="sparkles" size={12} />{" "}
                  {isAnalyzing ? "分析中..." : "AI 辅助分析"}
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <textarea
                      value={inputEn}
                      onChange={(e) => setInputEn(e.target.value)}
                      placeholder="粘贴英文提示词..."
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-mono text-xs h-40"
                    />
                    <textarea
                      value={inputThoughts}
                      onChange={(e) => setInputThoughts(e.target.value)}
                      placeholder="原始想法/语音描述..."
                      className="w-full px-5 py-4 bg-indigo-50/30 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all text-xs h-24"
                    />
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-4 shadow-inner border border-slate-100">
                    <input
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      placeholder="版本标题"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    />
                    <textarea
                      value={inputReason}
                      onChange={(e) => setInputReason(e.target.value)}
                      placeholder="迭代理由"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs h-16 outline-none"
                    />
                    <textarea
                      value={inputImperfection}
                      onChange={(e) => setInputImperfection(e.target.value)}
                      placeholder="不足之处"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs h-16 text-rose-600 outline-none"
                    />
                    <textarea
                      value={inputZh}
                      onChange={(e) => setInputZh(e.target.value)}
                      placeholder="提示词对照翻译"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs italic h-16 outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={saveVersion}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all active:scale-[0.98]"
                >
                  保存此原子迭代
                </button>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {filteredVersions.length === 0 ? (
              <div className="py-32 text-center opacity-20">
                <p className="font-bold tracking-widest uppercase text-[10px]">
                  No records found
                </p>
              </div>
            ) : (
              filteredVersions.map((v, idx) => (
                <div
                  key={v.id}
                  className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300"
                >
                  <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded uppercase">
                        V{filteredVersions.length - idx}
                      </div>
                      <h3 className="font-bold text-slate-800">{v.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyEn(v.id, v.enPrompt)}
                        className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-xl hover:text-indigo-600 hover:border-indigo-600 transition-all text-[10px] font-black uppercase shadow-sm"
                      >
                        <IconHelper name="copy" size={12} />{" "}
                        <span id={`copy-text-${v.id}`}>Copy</span>
                      </button>
                      <button
                        onClick={() => deleteVersion(v.id)}
                        className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                      >
                        <IconHelper name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                        <h4 className="text-indigo-600 text-[9px] font-black mb-2 flex items-center gap-2">
                          迭代原因
                        </h4>
                        <p className="text-xs font-bold text-indigo-900">
                          {v.reason}
                        </p>
                      </div>
                      <div className="flex-1 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                        <h4 className="text-rose-600 text-[9px] font-black mb-2 flex items-center gap-2">
                          改进建议
                        </h4>
                        <p className="text-xs font-bold text-rose-900">
                          {v.imperfection}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl text-[10px] font-mono leading-relaxed h-32 overflow-y-auto border-2 border-slate-800">
                        {v.enPrompt}
                      </div>
                      <div className="bg-slate-50 text-slate-500 p-6 rounded-3xl text-[10px] italic h-32 overflow-y-auto border border-slate-100 font-medium">
                        {v.zhPrompt}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* ==================== 批量重绘打版视图 ==================== */}
      {!isPrompt && (
        <main className="max-w-6xl mx-auto px-6 py-6 font-inter">
          <div className="flex flex-wrap items-center justify-between gap-6 mb-10 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                <IconHelper name="image" size={32} />
              </div>
              <div>
                <h2 className="font-black text-xl tracking-tight leading-none mb-1">
                  批量重绘队列
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight italic">
                  场景: {curProj?.name || "加载中..."}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach((f) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        addImageTask(result.split(",")[1], result);
                      };
                      reader.readAsDataURL(f);
                    });
                    e.target.value = "";
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border-2 border-slate-100 hover:border-indigo-600 hover:text-indigo-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all"
              >
                <IconHelper name="upload" size={18} /> 浏览
              </button>
              <button
                onClick={addUrlTask}
                className="bg-white border-2 border-slate-100 hover:border-indigo-600 hover:text-indigo-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all"
              >
                URL
              </button>
              <div className="w-px h-10 bg-slate-100 mx-2"></div>
              <button
                onClick={runPendingTasks}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                <IconHelper name="play" size={18} /> 开启生成
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentGenTasks.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 ${
                  t.status === "running"
                    ? "running-glow ring-2 ring-indigo-500"
                    : ""
                }`}
              >
                <div className="aspect-square bg-slate-100 relative group">
                  <img
                    src={
                      t.status === "success" && t.result
                        ? t.result
                        : t.sourceUrl
                    }
                    className={`w-full h-full object-cover transition-opacity duration-500 ${
                      t.status === "running" ? "opacity-30" : "opacity-100"
                    }`}
                    alt="task image"
                  />
                  {t.status === "running" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {t.status === "success" && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                      <IconHelper name="check" size={12} />
                    </div>
                  )}
                </div>
                <div className="p-6 flex justify-between items-center bg-slate-50/50 border-t">
                  <div className="flex gap-2">
                    {t.status === "success" && t.result && (
                      <button
                        onClick={() => downloadImg(t.result!)}
                        className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl active:scale-90 hover:bg-indigo-700 transition-all"
                      >
                        <IconHelper name="download" size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => runSingleTask(t.id)}
                      className="p-4 bg-white border border-slate-100 text-slate-300 hover:text-indigo-600 rounded-2xl active:scale-90 transition-all"
                    >
                      <IconHelper name="retry" size={18} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeTask(t.id)}
                    className="p-4 text-slate-200 hover:text-rose-500 transition-colors"
                  >
                    <IconHelper name="trash" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {currentGenTasks.length === 0 && (
            <div className="py-40 text-center rounded-[3rem] border-4 border-dashed border-slate-200">
              <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconHelper name="image" size={32} className="text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-400">尚未添加图片</h3>
              <p className="text-slate-300 text-sm mt-2 font-medium">
                支持从剪贴板 <b>Ctrl + V</b> 直接粘贴产品原图
              </p>
            </div>
          )}
        </main>
      )}

      {/* ==================== 设置弹窗 & Key 选择 ==================== */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 border border-white animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <IconHelper
                  name="config"
                  size={24}
                  className="text-indigo-600"
                />{" "}
                系统配置中心
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"
              >
                <IconHelper name="x" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 自动密钥选择区 */}
              {session && (
                <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 mb-6">
                  <h3 className="font-bold text-sm tracking-tight text-indigo-900 mb-3 flex items-center gap-2">
                    <IconHelper name="google" size={14} /> 自动发现 API 密钥 (从
                    Google Drive)
                  </h3>
                  {isSearchingKeys ? (
                    <div className="text-xs text-indigo-400">
                      正在扫描您的云盘文件...
                    </div>
                  ) : driveFiles.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                      {driveFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => selectKeyFile(file.id)}
                          className="text-left px-3 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-between"
                        >
                          <span className="truncate max-w-[120px]">
                            {file.name}
                          </span>
                          <IconHelper name="plus" size={10} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      未扫描到相关配置文件
                    </div>
                  )}
                  <button
                    onClick={searchKeysInDrive}
                    className="mt-3 text-[9px] font-black uppercase text-indigo-600 hover:underline"
                  >
                    重新扫描
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3">
                    Google AI Studio API Key (Gemini)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-mono text-sm"
                      placeholder="Paste your API key..."
                    />
                    <div className="absolute right-6 top-4 text-slate-300">
                      <IconHelper name="key" />
                    </div>
                  </div>
                </div>

                {!isPrompt && curProj && (
                  <div className="animate-in fade-in duration-300">
                    <label className="block text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] mb-3 flex justify-between items-center">
                      <span>当前项目打版提示词 (Image Prompt)</span>
                      <span className="text-slate-300 lowercase font-bold tracking-tight italic">
                        {curProj.name}
                      </span>
                    </label>
                    <textarea
                      value={curProj.genPrompt || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGenProjects(
                          genProjects.map((p) =>
                            p.id === activeGenId ? { ...p, genPrompt: val } : p
                          )
                        );
                      }}
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium leading-relaxed"
                      placeholder="例如：Professional product photography, soft studio lighting..."
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                save();
                setShowSettings(false);
              }}
              className="w-full mt-8 py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              保存当前所有配置
            </button>
          </div>
        </div>
      )}

      {/* 创建项目弹窗 */}
      {showProjectModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 border border-white">
            <h2 className="text-xl font-bold mb-4">创建新场景项目</h2>
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // trigger add logic
                }
              }}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="例如：花卉项目、服饰项目..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowProjectModal(false)}
                className="flex-1 font-bold text-slate-400"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!newProjectName) return;
                  const id = (isPrompt ? "pp_" : "gp_") + Date.now();
                  const newP = {
                    id,
                    name: newProjectName,
                    createdAt: new Date().toISOString(),
                  };
                  if (isPrompt) {
                    setPromptProjects([...promptProjects, newP]);
                    setActivePromptId(id);
                  } else {
                    setGenProjects([
                      ...genProjects,
                      { ...newP, genPrompt: "Professional studio lighting." },
                    ]);
                    setActiveGenId(id);
                  }
                  setNewProjectName("");
                  setShowProjectModal(false);
                }}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all"
              >
                立即创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
