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
  source: string | null; // 保留作为回退或状态标识
  sourceUrl: string; // 本地预览地址
  status: "ready" | "running" | "success" | "error";
  result: string | null;
  error: string | null;
  versionId?: string;
  fileUri?: string; // Google AI File API 返回的云端地址
}

export default function Home() {
  const { data: session, status } = useSession();
  const [genProjects, setGenProjects] = useState<Project[]>([]);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [genTasks, setGenTasks] = useState<GenTask[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

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
    let hasData = false;
    try {
      const saved = localStorage.getItem("prompt_lab_app_data1");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.genProjects?.length) {
          setGenProjects(data.genProjects);
          setActiveGenId(data.activeGenId || data.genProjects[0].id);
          setVersions(data.versions || []);
          setGenTasks(data.genTasks || []);
          hasData = true;
        }
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }

    if (!hasData) {
      const defaultGen = {
        id: "gp1",
        name: "默认项目",
        createdAt: new Date().toISOString(),
        genPrompt: "Professional studio lighting.",
      };
      setGenProjects([defaultGen]);
      setActiveGenId(defaultGen.id);

      // --- Mock Data for UI Testing Only on First Load ---
      const mockGenTasks: GenTask[] = [
        {
          id: "mock1",
          projectId: "gp1",
          source: null,
          sourceUrl:
            "https://images.unsplash.com/photo-1594913785162-e6786b42dea3?q=80&w=300&auto=format&fit=crop",
          status: "success",
          result:
            "https://images.unsplash.com/photo-1594913785162-e6786b42dea3?q=80&w=300&auto=format&fit=crop",
          error: null,
        },
        {
          id: "mock2",
          projectId: "gp1",
          source: null,
          sourceUrl:
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop",
          status: "running",
          result: null,
          error: null,
        },
        {
          id: "mock3",
          projectId: "gp1",
          source: null,
          sourceUrl:
            "https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=300&auto=format&fit=crop",
          status: "ready",
          result: null,
          error: null,
        },
      ];
      setGenTasks(mockGenTasks);
    }

    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  const save = useCallback(() => {
    try {
      // 存储性能与限额优化：限制任务总数
      let savedTasks = genTasks;
      if (genTasks.length > 30) {
        // 保留最近的 30 个，其余的移除大体积的 result
        savedTasks = genTasks.map((t, idx) =>
          idx < genTasks.length - 30 ? { ...t, result: null, source: null } : t
        );
      }

      const data = {
        genProjects,
        activeGenId,
        versions,
        genTasks: savedTasks,
      };

      const serialized = JSON.stringify(data);
      localStorage.setItem("prompt_lab_app_data1", serialized);
      localStorage.setItem("gemini_api_key", apiKey);
    } catch (e) {
      console.warn("Storage quota exceeded, trying to prune...", e);
      // 如果报错，说明 30 个还是太多，直接只存最近 10 个的结果
      const prunedTasks = genTasks.map((t, idx) =>
        idx < genTasks.length - 10 ? { ...t, result: null, source: null } : t
      );
      try {
        const data = {
          genProjects,
          activeGenId,
          versions,
          genTasks: prunedTasks,
        };
        localStorage.setItem("prompt_lab_app_data1", JSON.stringify(data));
      } catch (e2) {
        console.error("Critical storage failure", e2);
        // 极端情况下仅保存项目和版本，丢弃所有任务
        const minData = { genProjects, activeGenId, versions, genTasks: [] };
        localStorage.setItem("prompt_lab_app_data1", JSON.stringify(minData));
      }
    }
  }, [genProjects, activeGenId, versions, genTasks, apiKey]);

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
    if (!inputTitle || !inputEn || !activeGenId) return;
    const newV: Version = {
      id: "v_" + Date.now(),
      projectId: activeGenId,
      title: inputTitle,
      enPrompt: inputEn,
      zhPrompt: inputZh,
      reason: inputReason,
      imperfection: inputImperfection,
      createdAt: new Date().toISOString(),
    };
    setVersions([newV, ...versions]);
    setActiveVersionId(newV.id); // 自动选中新保存的版本
    setIsAdding(false);
    // 更新当前项目的提示词
    setGenProjects((prev) =>
      prev.map((p) => (p.id === activeGenId ? { ...p, genPrompt: inputEn } : p))
    );

    // Clear form
    setInputThoughts("");
    setInputTitle("");
    setInputReason("");
    setInputImperfection("");
    setInputZh("");

    // Show feedback
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
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

  // --- File API & Upload ---
  const uploadToFileAPI = async (base64: string): Promise<string> => {
    if (!apiKey) throw new Error("API Key required");

    // Extract mime type and actual base64 data
    const match = base64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image format");
    const mimeType = match[1];
    const data = match[2];

    // Simple Upload Protocol
    const res = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "multipart",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            display_name: `upload_${Date.now()}`,
          },
        }),
      }
    );

    // Note: For a robust implementation in a production environment,
    // we would use a multipart upload with the actual image data.
    // For this prototype, if the simplified API isnt available via fetch directly,
    // we use the 'inlineData' as a reliable fallback, but aiming for File API.
    // Given 'fetch' limitations with complex multipart in browser without specific libs,
    // let's implement the standard multipart/related structure:

    const boundary = "-------" + Math.random().toString(36).substring(2);
    const metadata = JSON.stringify({
      file: { display_name: `img_${Date.now()}` },
    });

    const body = [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      `${metadata}\r\n`,
      `--${boundary}\r\n`,
      `Content-Type: ${mimeType}\r\n`,
      `Content-Transfer-Encoding: base64\r\n\r\n`,
      `${data}\r\n`,
      `--${boundary}--`,
    ].join("");

    const uploadRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: body,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || "File upload failed");
    }

    const fileInfo = await uploadRes.json();
    return fileInfo.file.uri; // This is the 'fileData' URI
  };

  // --- Generator Logic ---
  const addImageTask = async (base64: string | null, previewUrl: string) => {
    if (!activeGenId) return;

    const taskId = "t_" + Date.now() + Math.random().toString(36).slice(2);
    const newTask: GenTask = {
      id: taskId,
      projectId: activeGenId,
      source: base64,
      sourceUrl: previewUrl,
      status: "ready",
      result: null,
      error: null,
      versionId: activeVersionId || undefined,
    };

    setGenTasks((prev) => [...prev, newTask]);

    // Async upload if base64 is available
    if (base64) {
      try {
        const uri = await uploadToFileAPI(base64);
        setGenTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, fileUri: uri, source: null } : t
          )
        );
      } catch (e: any) {
        console.warn("File API upload failed, will fallback to inlineData", e);
      }
    }
  };

  const removeTask = (id: string) => {
    setGenTasks(genTasks.filter((t) => t.id !== id));
  };

  const runSingleTask = async (taskIds: string[]) => {
    const tasks = genTasks.filter((t) => taskIds.includes(t.id));
    if (tasks.length === 0 || !apiKey || !activeGenId) return;

    const curP = genProjects.find((p) => p.id === activeGenId);

    // 创建一个新的任务来承载结果
    const resultTaskId = "res_" + Date.now();
    const resultTask: GenTask = {
      id: resultTaskId,
      projectId: activeGenId,
      source: null,
      sourceUrl: tasks[0].sourceUrl, // 使用第一张图作为占位预览
      status: "running" as const,
      result: null,
      error: null,
      versionId: activeVersionId || undefined,
    };

    setGenTasks((prev) => [
      ...prev.map((t) =>
        taskIds.includes(t.id) ? { ...t, status: "running" as const } : t
      ),
      resultTask,
    ]);

    try {
      const parts: any[] = [
        { text: curP?.genPrompt || "Professional photography" },
      ];

      // 合并所有图片 parts
      for (const task of tasks) {
        if (task.fileUri) {
          parts.push({
            fileData: { mimeType: "image/png", fileUri: task.fileUri },
          });
        } else if (task.source) {
          const b64Data = task.source.split(",")[1];
          parts.push({ inlineData: { mimeType: "image/png", data: b64Data } });
        }
      }

      const body = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { imageSize: "1K" },
        },
      };

      // 使用最新的 Nano Banana Pro 模型
      const modelId = "gemini-3-pro-image-preview";
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
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
          const match = trimmedText.match(/data:image\/[^;]+;base64,[^"'\s$]+/);
          if (match) resultData = match[0];
          else if (/^[A-Za-z0-9+/=]+$/.test(trimmedText)) {
            resultData = `data:image/png;base64,${trimmedText}`;
          }
        }

        if (resultData) {
          setGenTasks((prev) =>
            prev.map((t) =>
              t.id === resultTaskId
                ? { ...t, status: "success" as const, result: resultData }
                : taskIds.includes(t.id)
                ? { ...t, status: "success" as const }
                : t
            )
          );
        } else {
          throw new Error("AI response had no image data.");
        }
      } else {
        throw new Error("AI did not return an image.");
      }
    } catch (e: any) {
      setGenTasks((prev) =>
        prev.map((t) =>
          t.id === resultTaskId
            ? { ...t, status: "error" as const, error: e.message }
            : t
        )
      );
    }
  };

  const runPendingTasks = async () => {
    const readyTasks = genTasks.filter(
      (t) => t.projectId === activeGenId && t.status === "ready"
    );
    if (readyTasks.length === 0) return;

    // 一次性发送所有 Ready 图片
    await runSingleTask(readyTasks.map((t) => t.id));
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
  }, [activeGenId, genTasks]);

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

  // Derived
  const curProj = genProjects.find((p) => p.id === activeGenId);
  const currentGenTasks = genTasks.filter((t) => t.projectId === activeGenId);
  const filteredVersions = versions.filter((v) => v.projectId === activeGenId);

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
            <div className="h-full px-2 font-bold text-sm transition-all border-b-3 active-tab flex items-center">
              AI 生图实验室
            </div>
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
        </div>
      </nav>

      {/* ==================== AI 生图视图 ==================== */}
      <main className="flex h-[calc(100vh-80px)] overflow-hidden bg-[#f8fafd]">
        {/* 左侧侧边栏 - 项目列表 */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              我的项目
            </h2>
            <div className="space-y-1">
              {genProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveGenId(p.id);
                    setActiveVersionId(null);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeGenId === p.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowProjectModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-all"
            >
              <IconHelper name="plus" size={12} />
              新建项目
            </button>
          </div>
        </aside>

        {/* 右侧主工作区 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* 顶部操作条 */}
          <header className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-800">
                {curProj?.name}
              </h2>
              <div className="h-4 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200">
                <IconHelper
                  name="sparkles"
                  size={14}
                  className="text-indigo-500"
                />
                Nano Banana
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={activeVersionId || ""}
                  onChange={(e) => {
                    const vid = e.target.value;
                    setActiveVersionId(vid || null);
                    const v = versions.find((v) => v.id === vid);
                    if (v) {
                      setGenProjects((prev) =>
                        prev.map((p) =>
                          p.id === activeGenId
                            ? { ...p, genPrompt: v.enPrompt }
                            : p
                        )
                      );
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
                >
                  <option value="">
                    当前预览{" "}
                    {activeVersionId === null && curProj?.genPrompt
                      ? "(已修改)"
                      : ""}
                  </option>
                  {versions
                    .filter((v) => v.projectId === activeGenId)
                    .map((v, idx, arr) => (
                      <option key={v.id} value={v.id}>
                        V{arr.length - idx}: {v.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 mx-1"></div>

              <button
                onClick={() => {
                  setInputEn(curProj?.genPrompt || "");
                  setIsAdding(true);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 border rounded-full text-xs font-bold transition-all shadow-sm ${
                  showSaveSuccess
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <IconHelper
                  name={showSaveSuccess ? "check" : "save"}
                  size={12}
                />
                {showSaveSuccess ? "保存成功" : "保存提示词"}
              </button>

              <button
                onClick={runPendingTasks}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              >
                <IconHelper name="play" size={14} />
                立即生成
              </button>
            </div>
          </header>

          <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
            {/* 核心编辑区 */}
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 提示词输入 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      提示词输入
                    </label>
                    {activeVersionId && (
                      <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                        <IconHelper name="check" size={10} /> 正在使用版本 V
                        {versions.filter((v) => v.projectId === activeGenId)
                          .length -
                          versions
                            .filter((v) => v.projectId === activeGenId)
                            .findIndex((v) => v.id === activeVersionId)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 迭代录入弹窗 (复用之前的逻辑，但在生图页面展示) */}
                {isAdding && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-blue-800">
                        保存提示词版本
                      </h3>
                      <button
                        onClick={handleAIAnalyze}
                        disabled={isAnalyzing}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        {isAnalyzing ? "正在 AI 分析..." : "AI 辅助分析"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        value={inputTitle}
                        onChange={(e) => setInputTitle(e.target.value)}
                        placeholder="给这次版本起个名字"
                        className="col-span-2 px-4 py-2 bg-white border rounded-xl text-sm outline-none"
                      />
                      <textarea
                        value={inputReason}
                        onChange={(e) => setInputReason(e.target.value)}
                        placeholder="迭代理由"
                        className="px-4 py-2 bg-white border rounded-xl text-xs h-20 outline-none"
                      />
                      <textarea
                        value={inputImperfection}
                        onChange={(e) => setInputImperfection(e.target.value)}
                        placeholder="不足之处"
                        className="px-4 py-2 bg-white border rounded-xl text-xs h-20 outline-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-400"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveVersion}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg"
                      >
                        确认保存
                      </button>
                    </div>
                  </div>
                )}

                {/* 提示词输入 */}
                <div>
                  <textarea
                    value={curProj?.genPrompt || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGenProjects(
                        genProjects.map((p) =>
                          p.id === activeGenId ? { ...p, genPrompt: val } : p
                        )
                      );
                      // 如果用户手动修改，则取消当前的选中版本
                      if (activeVersionId) setActiveVersionId(null);
                    }}
                    placeholder="输入您的提示词... 例如: Professional photography, studio lighting."
                    className="w-full h-32 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm leading-relaxed"
                  />
                </div>

                {/* 待生成图片预览 (移动至此，更靠近操作区) */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                      等待生成队列 (
                      {
                        currentGenTasks.filter((t) => t.status === "ready")
                          .length
                      }
                      )
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addUrlTask}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        外链上传
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {/* 直接上传/粘贴的入口引导 */}
                    <div
                      onClick={() =>
                        document.getElementById("fileInput")?.click()
                      }
                      className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all cursor-pointer bg-slate-50/50"
                    >
                      <IconHelper name="plus" size={20} />
                      <span className="text-[9px] font-black mt-1 uppercase">
                        粘贴/上传
                      </span>
                    </div>
                    {currentGenTasks
                      .filter((t) => t.status === "ready")
                      .map((t) => (
                        <div
                          key={t.id}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group shadow-sm bg-white"
                        >
                          <img
                            src={t.sourceUrl}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => removeTask(t.id)}
                              className="p-1.5 bg-white text-rose-500 rounded-lg shadow-lg hover:scale-110 transition-transform"
                            >
                              <IconHelper name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                    {currentGenTasks.filter((t) => t.status === "ready")
                      .length === 0 && (
                      <div className="flex-1 flex items-center h-20 px-4 bg-slate-50/50 rounded-2xl border border-dotted border-slate-200">
                        <p className="text-[10px] font-bold text-slate-300 italic">
                          可以直接在此区域 Ctrl+V 粘贴多张图片
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 结果列表 - 卡片式 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <IconHelper name="grid" size={16} className="text-blue-600" />
                  生成结果
                </h3>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                  {currentGenTasks.filter((t) => t.status === "success").length}{" "}
                  已完成
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {currentGenTasks
                  .filter((t) => t.status !== "ready")
                  .map((t) => {
                    const usedVersion = versions.find(
                      (v) => v.id === t.versionId
                    );
                    const vList = versions.filter(
                      (v) => v.projectId === t.projectId
                    );
                    const vNum = usedVersion
                      ? vList.length -
                        vList.findIndex((v) => v.id === usedVersion.id)
                      : null;

                    return (
                      <div
                        key={t.id}
                        className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 ${
                          t.status === "running"
                            ? "ring-2 ring-blue-400 ring-offset-4 ring-offset-[#f8fafd]"
                            : ""
                        }`}
                      >
                        <div className="relative aspect-square bg-slate-50">
                          <img
                            src={
                              t.status === "success" && t.result
                                ? t.result
                                : t.sourceUrl
                            }
                            className={`w-full h-full object-cover transition-opacity duration-500 ${
                              t.status === "running"
                                ? "opacity-40"
                                : "opacity-100"
                            }`}
                            alt=""
                          />
                          {t.status === "running" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                          <div className="absolute top-4 left-4">
                            {vNum && (
                              <div className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black rounded-lg">
                                V{vNum}
                              </div>
                            )}
                          </div>
                          <div className="absolute top-4 right-4 flex gap-2">
                            {t.status === "success" && (
                              <div className="w-8 h-8 bg-emerald-500 text-white flex items-center justify-center rounded-full shadow-lg">
                                <IconHelper name="check" size={14} />
                              </div>
                            )}
                            {t.status === "error" && (
                              <div className="w-8 h-8 bg-rose-500 text-white flex items-center justify-center rounded-full shadow-lg">
                                <IconHelper name="x" size={14} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-5 flex items-center justify-between border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            {t.status === "success" && t.result && (
                              <button
                                onClick={() => downloadImg(t.result!)}
                                className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                <IconHelper name="download" size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => runSingleTask([t.id])}
                              className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                            >
                              <IconHelper name="retry" size={18} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeTask(t.id)}
                            className="p-3 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <IconHelper name="trash" size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {currentGenTasks.length === 0 && (
                  <div className="col-span-full py-32 text-center bg-white border border-slate-200 border-dashed rounded-[3rem]">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <IconHelper
                        name="image"
                        size={28}
                        className="text-slate-200"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400">
                      目前没有任何生成任务
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 uppercase tracking-widest font-bold">
                      请上传或粘贴产品图片
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

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
                  const id = "gp_" + Date.now();
                  const newP = {
                    id,
                    name: newProjectName,
                    createdAt: new Date().toISOString(),
                    genPrompt: "Professional studio lighting.",
                  };
                  setGenProjects([...genProjects, newP]);
                  setActiveGenId(id);
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
