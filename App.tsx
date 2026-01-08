
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  History, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Check, 
  Save, 
  ArrowRight,
  Loader2,
  FolderOpen,
  AlertCircle,
  Key,
  Edit2,
  X,
  Maximize2,
  Clock,
  Zap,
  Sun,
  Moon,
  Info,
  Settings2,
  Play,
  GripVertical
} from 'lucide-react';
import { Project, PromptVersion, GeneratedResult, ImageReference, AppStatus, LogEntry, GenConfig } from './types';
import { generateImage } from './services/geminiService';
import { saveProjectsToDB, getProjectsFromDB, deleteProjectFromDB } from './db';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const DEFAULT_LOGS: LogEntry[] = [
  { id: '1', date: '2024-05-20', content: '初始化 AI Creative Lab 实验室架构。' },
  { id: '2', date: '2024-05-21', content: '集成 IndexedDB，彻底解决 5MB 存储上限导致的崩溃问题。' },
  { id: '3', date: '2024-05-22', content: '新增资产选择排序功能，支持根据序号精准控制生图上下文顺序。' },
  { id: '4', date: '2024-05-22', content: '支持明亮/暗黑模式切换，优化界面视觉质感。' },
  { id: '5', date: '2024-05-23', content: '新增生图参数配置菜单（支持 1K/2K/4K），优化暗黑模式按钮对比度。' },
  { id: '6', date: '2024-05-24', content: '资产库支持拖拽重排顺序，生图逻辑将严格遵循视觉排列顺序。' }
];

const DEFAULT_CONFIG: GenConfig = {
  imageSize: '1K',
  aspectRatio: '1:1'
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApiKeySelected, setIsApiKeySelected] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);
  const isModified = activeProject ? (currentPrompt !== activeProject.lastPrompt) : false;

  // Computed selected assets in visual order
  const selectedAssets = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.assets
      .filter(a => a.selected)
      .map((asset, index, filteredArray) => {
        // The order is simply its position in the filtered array of selected items
        return { ...asset, selectedOrder: index + 1 };
      });
  }, [activeProject?.assets]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await getProjectsFromDB();
        if (saved && saved.length > 0) {
          setProjects(saved);
          setActiveProjectId(saved[0].id);
        } else {
          const initial: Project = {
            id: crypto.randomUUID(),
            name: '新建实验室项目',
            versions: [{
              id: crypto.randomUUID(),
              name: 'V1 Initial',
              prompt: 'A futuristic city, cinematic lighting',
              timestamp: Date.now()
            }],
            results: [],
            lastPrompt: 'A futuristic city, cinematic lighting',
            assets: [],
            updateLogs: DEFAULT_LOGS,
            config: DEFAULT_CONFIG
          };
          setProjects([initial]);
          setActiveProjectId(initial.id);
          setCurrentPrompt(initial.lastPrompt);
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
    if (projects.length > 0) saveProjectsToDB(projects);
  }, [projects]);

  useEffect(() => {
    if (activeProject) {
      setCurrentPrompt(activeProject.lastPrompt);
      if (activeProject.versions.length > 0 && !activeVersionId) {
        setActiveVersionId(activeProject.versions[activeProject.versions.length - 1].id);
      }
    }
  }, [activeProjectId]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setIsApiKeySelected(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsApiKeySelected(true);
    }
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `新项目 ${projects.length + 1}`,
      versions: [],
      results: [],
      lastPrompt: '',
      assets: [],
      updateLogs: DEFAULT_LOGS,
      config: DEFAULT_CONFIG
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setEditingProjectName(true);
  };

  const updateProjectName = (newName: string) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name: newName } : p));
  };

  const updateProjectConfig = (key: keyof GenConfig, value: string) => {
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId ? { ...p, config: { ...p.config, [key]: value } } : p
    ));
  };

  const handleSavePrompt = () => {
    if (!activeProject) return;
    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      name: `V${activeProject.versions.length + 1}`,
      prompt: currentPrompt,
      timestamp: Date.now()
    };
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId ? { ...p, versions: [...p.versions, newVersion], lastPrompt: currentPrompt } : p
    ));
    setActiveVersionId(newVersion.id);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const handleFiles = (files: FileList | File[], autoSelect: boolean = true) => {
    if (!activeProjectId || !activeProject) return;
    
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        const newAsset: ImageReference = {
          id: crypto.randomUUID(),
          data,
          mimeType: file.type,
          name: file.name,
          selected: autoSelect
        };
        setProjects(prev => prev.map(p => 
          p.id === activeProjectId ? { ...p, assets: [...p.assets, newAsset] } : p
        ));
      };
      reader.readAsDataURL(file);
    });
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) files.push(blob);
      }
    }
    if (files.length > 0) handleFiles(files, true);
  };

  const toggleAssetSelection = (assetId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        assets: p.assets.map(a => a.id === assetId ? { ...a, selected: !a.selected } : a)
      };
    }));
  };

  const deleteAsset = (assetId: string) => {
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId ? { ...p, assets: p.assets.filter(a => a.id !== assetId) } : p
    ));
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newAssets = [...p.assets];
      const draggedItem = newAssets[draggedIndex];
      newAssets.splice(draggedIndex, 1);
      newAssets.splice(index, 0, draggedItem);
      return { ...p, assets: newAssets };
    }));
    setDraggedIndex(index);
  };

  const handleGenerate = async () => {
    if (!isApiKeySelected) return handleOpenKeySelector();
    if (!currentPrompt.trim()) return;

    setStatus(AppStatus.LOADING);
    setErrorMsg(null);
    const startPerf = performance.now();

    try {
      const finalSelected = selectedAssets; // already sorted by visual position
      const imageUrl = await generateImage(currentPrompt, finalSelected, activeProject?.config || DEFAULT_CONFIG);
      const duration = (performance.now() - startPerf) / 1000;

      const newResult: GeneratedResult = {
        id: crypto.randomUUID(),
        imageUrl,
        promptVersionId: activeVersionId || 'custom',
        promptText: currentPrompt,
        timestamp: Date.now(),
        duration
      };

      setProjects(prev => prev.map(p => 
        p.id === activeProjectId ? { ...p, results: [newResult, ...p.results] } : p
      ));
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      setErrorMsg(err.message === "API_KEY_EXPIRED" ? "授权过期，请重新关联 API Key" : (err.message || "生图失败"));
      setStatus(AppStatus.ERROR);
      if (err.message === "API_KEY_EXPIRED") setIsApiKeySelected(false);
    }
  };

  // Helper to find visual selection order for a given asset
  const getSelectedOrder = (id: string) => {
    const index = selectedAssets.findIndex(a => a.id === id);
    return index !== -1 ? index + 1 : null;
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"><X size={32} /></button>
          <img src={lightboxImage} alt="Fullscreen" className="max-w-[95%] max-h-[95%] object-contain rounded-lg shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`w-72 border-r flex flex-col transition-colors ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg">B</div>
            <span className="font-bold tracking-tight uppercase text-xs">Nano Lab Pro</span>
          </div>
          <button onClick={handleCreateProject} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"><Plus size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">实验室项目</div>
          {projects.map(p => (
            <div 
              key={p.id}
              onClick={() => setActiveProjectId(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group cursor-pointer ${
                activeProjectId === p.id 
                  ? 'bg-blue-600/15 text-blue-600 ring-1 ring-blue-500/30 font-bold' 
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FolderOpen size={16} className={activeProjectId === p.id ? 'text-blue-500' : 'text-slate-400'} />
              <span className="truncate flex-1 text-left">{p.name}</span>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('删除项目？')) setProjects(prev => prev.filter(item => item.id !== p.id)); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <div className={`p-4 border-t ${darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Info size={12} className="text-blue-500" /> 更新记录
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {activeProject?.updateLogs?.map(log => (
              <div key={log.id} className="text-[11px] leading-relaxed">
                <span className="text-blue-500 font-mono font-bold mr-1">{log.date}</span>
                <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{log.content}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <button 
            onClick={handleOpenKeySelector}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
              isApiKeySelected ? 'bg-green-600/10 text-green-600 border border-green-600/20' : 'bg-amber-600/10 text-amber-600 animate-pulse border border-amber-600/20'
            }`}
          >
            <Key size={14} /> {isApiKeySelected ? 'API Key 已连接' : '配置 API Key'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className={`h-16 border-b flex items-center justify-between px-6 z-20 transition-colors ${darkMode ? 'bg-slate-900/60 border-slate-800 backdrop-blur-md' : 'bg-white/80 border-slate-200 backdrop-blur-md shadow-sm'}`}>
          <div className="flex items-center gap-4 flex-1">
            {editingProjectName ? (
              <input
                autoFocus
                className="bg-slate-100 dark:bg-slate-800 border-none outline-none text-lg font-bold px-2 py-1 rounded-lg w-64 ring-2 ring-blue-600"
                value={activeProject?.name || ''}
                onChange={(e) => updateProjectName(e.target.value)}
                onBlur={() => setEditingProjectName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingProjectName(false)}
              />
            ) : (
              <h2 className="text-lg font-bold cursor-pointer hover:text-blue-500 flex items-center gap-2 group" onClick={() => setEditingProjectName(true)}>
                {activeProject?.name || '新实验室项目'} <Edit2 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
            )}
            
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-1.5 border dark:border-slate-700 shadow-inner">
              <History size={14} className="text-blue-500 mr-2" />
              <select 
                className="bg-transparent text-xs font-black outline-none appearance-none cursor-pointer pr-4 uppercase"
                value={activeVersionId || ''}
                onChange={(e) => {
                  const v = activeProject?.versions.find(ver => ver.id === e.target.value);
                  if (v) { setActiveVersionId(v.id); setCurrentPrompt(v.prompt); }
                }}
              >
                {activeProject?.versions.map(v => <option key={v.id} value={v.id} className="dark:bg-slate-900">{v.name}</option>)}
                {!activeProject?.versions.length && <option disabled>无版本记录</option>}
              </select>
              {isModified && <div className="w-2 h-2 rounded-full bg-amber-500 ml-1 shadow-lg animate-pulse"></div>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-95">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={handleSavePrompt}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                showSaveSuccess 
                ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/20' 
                : darkMode 
                  ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-600 hover:border-slate-400 shadow-xl' 
                  : 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200 hover:border-slate-400 shadow-sm'
              }`}
            >
              {showSaveSuccess ? <Check size={16} /> : <Save size={16} />} 
              <span className="hidden md:inline">保存版本</span>
            </button>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-2.5 rounded-xl transition-all border ${showConfig ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 dark:border-slate-700'}`}
                >
                  <Settings2 size={20} />
                </button>
                {showConfig && (
                  <div className={`absolute right-0 mt-3 w-56 rounded-2xl p-4 shadow-2xl border transition-all animate-in slide-in-from-top-2 z-50 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">生成分辨率 (Size)</div>
                        <div className="grid grid-cols-3 gap-2">
                          {(['1K', '2K', '4K'] as const).map(size => (
                            <button 
                              key={size}
                              onClick={() => updateProjectConfig('imageSize', size)}
                              className={`py-1.5 rounded-lg text-[10px] font-black transition-all border ${activeProject?.config.imageSize === size ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent'}`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">画面比例 (Aspect)</div>
                        <select 
                          className={`w-full text-xs py-2.5 rounded-lg px-3 outline-none border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-500' : 'bg-slate-100 border-slate-200 focus:border-blue-500'}`}
                          value={activeProject?.config.aspectRatio || '1:1'}
                          onChange={(e) => updateProjectConfig('aspectRatio', e.target.value)}
                        >
                          <option value="1:1">1:1 正方形</option>
                          <option value="16:9">16:9 宽屏</option>
                          <option value="9:16">9:16 竖屏</option>
                          <option value="4:3">4:3 标准</option>
                          <option value="3:4">3:4 照片</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={handleGenerate}
                disabled={status === AppStatus.LOADING || !currentPrompt.trim()}
                className="group flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all shadow-xl shadow-blue-900/30 disabled:opacity-50 active:scale-95"
              >
                {status === AppStatus.LOADING ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                {status === AppStatus.LOADING ? '渲染中...' : 'RUN'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar" onClick={() => setShowConfig(false)}>
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm animate-in slide-in-from-top-4 shadow-lg">
              <AlertCircle size={18} /> <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="ml-auto hover:scale-110 transition-transform"><X size={16} /></button>
            </div>
          )}

          {/* Prompt Editor */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <ArrowRight size={12} className="text-blue-500" /> 提示词实验室 (Prompt Editor)
            </h3>
            <div className="relative group">
              <textarea
                value={currentPrompt}
                onPaste={onPaste}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                placeholder="在此粘贴图片或输入提示词... 使用 [IMAGE_1] 引用资产库网格顺序。"
                className={`w-full h-48 rounded-3xl p-8 text-xl leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-2xl ${darkMode ? 'bg-slate-900/40 border-slate-800 border focus:border-blue-600 placeholder:text-slate-700' : 'bg-white border-slate-200 border focus:border-blue-500 placeholder:text-slate-300'}`}
              />
              <div className="absolute bottom-6 right-8 text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded shadow-sm">{currentPrompt.length} chars</div>
            </div>
          </section>

          {/* Asset Sequence Library with Drag & Drop */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon size={12} className="text-blue-500" /> 项目资产库 (支持拖拽重排顺序)
              </h3>
              <label className="cursor-pointer px-5 py-2 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl text-[10px] font-bold text-blue-500 transition-all uppercase tracking-widest border border-blue-600/20 active:scale-95">
                <Plus size={14} className="inline mr-2" /> 上传资产
                <input type="file" multiple accept="image/*" onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
              </label>
            </div>

            {activeProject && activeProject.assets.length === 0 ? (
              <div className={`border-2 border-dashed rounded-3xl h-36 flex flex-col items-center justify-center transition-all cursor-pointer group hover:scale-[1.01] ${darkMode ? 'border-slate-800 bg-slate-900/10 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'}`} onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
                <div className="p-4 bg-slate-200 dark:bg-slate-800 rounded-full mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
                   <ImageIcon size={32} />
                </div>
                <span className="text-xs uppercase tracking-widest font-black opacity-30 group-hover:opacity-60 transition-opacity">支持直接在编辑器内粘贴或拖入图片</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-5">
                {activeProject?.assets.map((img, idx) => {
                  const order = getSelectedOrder(img.id);
                  return (
                    <div 
                      key={img.id} 
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={() => setDraggedIndex(null)}
                      onClick={() => toggleAssetSelection(img.id)}
                      className={`relative aspect-square cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden group transition-all ring-offset-4 shadow-xl ${darkMode ? 'ring-offset-slate-950' : 'ring-offset-white'} ${
                        img.selected 
                          ? 'ring-4 ring-blue-500 scale-95' 
                          : `ring-1 ${darkMode ? 'ring-slate-800' : 'ring-slate-200'} opacity-60 hover:opacity-100 grayscale hover:grayscale-0 hover:scale-105`
                      } ${draggedIndex === idx ? 'opacity-20 scale-110' : ''}`}
                    >
                      <img src={img.data} alt={img.name} className="w-full h-full object-cover pointer-events-none" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                      
                      {/* Selection Order badge */}
                      {img.selected && (
                        <div className="absolute top-2 right-2 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-2xl animate-in zoom-in-50 border-2 border-white/30 z-10">
                          {order}
                        </div>
                      )}

                      {/* Visual Indicator of Global Index */}
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md py-1 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter border-t border-slate-800 pointer-events-none">
                        IMG_{idx + 1}
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteAsset(img.id); }} 
                        className="absolute bottom-2 right-2 bg-red-500 p-2 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-xl z-20"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Drag handle visual overlay on hover */}
                      <div className="absolute left-2 top-2 bg-black/50 p-1 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity">
                         <GripVertical size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Results Archive */}
          <section className="space-y-4 pb-24">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={12} className="text-blue-500" /> 实验室生成成果 (Archive)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {status === AppStatus.LOADING && (
                <div className={`aspect-square rounded-3xl flex flex-col items-center justify-center border overflow-hidden relative shadow-2xl transition-all ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-transparent to-blue-400/5 animate-pulse"></div>
                  <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">正在渲染...</p>
                </div>
              )}

              {activeProject?.results.map(result => (
                <div key={result.id} className={`group flex flex-col border rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-blue-500/5 ${darkMode ? 'bg-slate-900/80 border-slate-800 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-400'}`}>
                  <div className="relative aspect-square overflow-hidden cursor-zoom-in" onClick={() => setLightboxImage(result.imageUrl)}>
                    <img src={result.imageUrl} alt="Result" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-3 translate-y-2 group-hover:translate-y-0">
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(result.imageUrl, `lab-${result.id}.png`); }} className="bg-black/90 backdrop-blur-xl p-3 rounded-2xl text-white hover:bg-blue-600 shadow-2xl transition-all scale-90 hover:scale-100"><Download size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setLightboxImage(result.imageUrl); }} className="bg-black/90 backdrop-blur-xl p-3 rounded-2xl text-white hover:bg-slate-700 shadow-2xl transition-all scale-90 hover:scale-100"><Maximize2 size={18} /></button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className={`text-[12px] font-medium line-clamp-2 italic leading-relaxed opacity-80 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>"{result.promptText}"</p>
                    <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800/50">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
                          {activeProject.versions.find(v => v.id === result.promptVersionId)?.name || 'MOD'}
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                          <Clock size={10} /> {new Date(result.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        {result.duration && <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md"><Zap size={10} className="text-amber-500" /> {result.duration.toFixed(1)}s</div>}
                      </div>
                      <button onClick={() => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, results: p.results.filter(r => r.id !== result.id) } : p))} className="text-slate-400 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-500/5"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
