"use client";

import React from "react";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Maximize2,
  GripVertical,
} from "lucide-react";
import { ImageReference } from "@/lib/types";

interface AssetLibraryProps {
  assets: ImageReference[];
  onAssetsChange: (assets: ImageReference[]) => void;
  onLightbox: (url: string) => void;
  darkMode: boolean;
}

export default function AssetLibrary({
  assets,
  onAssetsChange,
  onLightbox,
  darkMode,
}: AssetLibraryProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [isOverTrash, setIsOverTrash] = React.useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const assetsToAdd: ImageReference[] = [];
    let processedCount = 0;
    const filesArray = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );

    if (filesArray.length === 0) return;

    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        const newAsset: ImageReference = {
          id: crypto.randomUUID(),
          data,
          mimeType: file.type,
          name: file.name,
          selected: true,
        };
        assetsToAdd.push(newAsset);
        processedCount++;

        if (processedCount === filesArray.length) {
          const currentAssets = assets || [];
          const maxOrder = currentAssets.reduce(
            (max, a) => Math.max(max, a.selectedOrder || 0),
            0
          );
          const assetsWithOrder = assetsToAdd.map((asset, i) => ({
            ...asset,
            selectedOrder: maxOrder + i + 1,
          }));
          onAssetsChange([...currentAssets, ...assetsWithOrder]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 全局粘贴处理
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) files.push(blob);
        }
      }

      if (files.length > 0) {
        handleFiles(files);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [assets, onAssetsChange]);

  const toggleAssetSelection = (assetId: string) => {
    const currentAssets = assets || [];
    const index = currentAssets.findIndex((a) => a.id === assetId);
    if (index === -1) return;

    const asset = currentAssets[index];
    const isSelecting = !asset.selected;

    let newAssets = [...currentAssets];
    if (isSelecting) {
      // Find max selectedOrder
      const maxOrder = currentAssets.reduce(
        (max, a) => Math.max(max, a.selectedOrder || 0),
        0
      );
      newAssets[index] = {
        ...asset,
        selected: true,
        selectedOrder: maxOrder + 1,
      };
    } else {
      // Unselecting: remove order and decrement others
      const removedOrder = asset.selectedOrder || 0;
      newAssets = newAssets.map((a) => {
        if (a.id === assetId) {
          return { ...a, selected: false, selectedOrder: undefined };
        }
        if (a.selected && (a.selectedOrder || 0) > removedOrder) {
          return { ...a, selectedOrder: (a.selectedOrder || 0) - 1 };
        }
        return a;
      });
    }

    onAssetsChange(newAssets);
  };

  const deleteAsset = (assetId: string) => {
    onAssetsChange((assets || []).filter((a) => a.id !== assetId));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const currentAssets = assets || [];
    const newAssets = [...currentAssets];
    const draggedItem = newAssets[draggedIndex];
    newAssets.splice(draggedIndex, 1);
    newAssets.splice(index, 0, draggedItem);
    onAssetsChange(newAssets);
    setDraggedIndex(index);
  };

  const handleDropToTrash = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverTrash(false);
    if (draggedIndex !== null) {
      const assetToDelete = assets[draggedIndex];
      if (assetToDelete) {
        deleteAsset(assetToDelete.id);
      }
      setDraggedIndex(null);
    }
  };

  const getSelectedOrder = (id: string) => {
    const asset = (assets || []).find((a) => a.id === id);
    return asset?.selected ? asset.selectedOrder : null;
  };

  return (
    <section className="space-y-4 relative">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ImageIcon size={12} className="text-blue-500" /> 项目资产库
          </h3>
          <span className="text-[9px] text-slate-400 font-medium px-5">
            (支持 Ctrl+V 直接粘贴上传)
          </span>
        </div>
        <label className="cursor-pointer px-5 py-2 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl text-[10px] font-bold text-blue-500 transition-all uppercase tracking-widest border border-blue-600/20 active:scale-95">
          <Plus size={14} className="inline mr-2" /> 上传资产
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex gap-4">
        {/* Assets Grid */}
        <div className="flex-1">
          {(assets || []).length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-3xl h-36 flex flex-col items-center justify-center transition-all cursor-pointer group hover:scale-[1.01] ${
                darkMode
                  ? "border-slate-800 bg-slate-900/10 hover:border-slate-700"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() =>
                (
                  document.querySelector(
                    'input[type="file"]'
                  ) as HTMLInputElement
                )?.click()
              }
            >
              <div className="p-4 bg-slate-200 dark:bg-slate-800 rounded-full mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
                <ImageIcon size={32} />
              </div>
              <span className="text-xs uppercase tracking-widest font-black opacity-30 group-hover:opacity-60 transition-opacity">
                支持拖放图片
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 gap-3">
              {(assets || []).map((img, idx) => {
                const order = getSelectedOrder(img.id);
                return (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={() => setDraggedIndex(null)}
                    className={`relative aspect-square cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden group transition-all ring-offset-4 shadow-xl ${
                      darkMode ? "ring-offset-slate-950" : "ring-offset-white"
                    } ${
                      img.selected
                        ? "ring-4 ring-blue-500 scale-95"
                        : `ring-1 ${
                            darkMode ? "ring-slate-800" : "ring-slate-200"
                          } opacity-90 hover:opacity-100`
                    } ${draggedIndex === idx ? "opacity-20 scale-110" : ""}`}
                  >
                    <img
                      src={img.data}
                      alt={img.name}
                      className="w-full h-full object-cover pointer-events-none transition-transform duration-500 ease-out"
                    />

                    {/* Interaction Zones */}
                    <div className="absolute inset-0 flex flex-col pointer-events-none">
                      {/* Top 1/3 for Selection */}
                      <div
                        className="h-1/3 w-full pointer-events-auto cursor-pointer"
                        title="点击选择/取消选择"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssetSelection(img.id);
                        }}
                      />
                      {/* Bottom 2/3 for Lightbox */}
                      <div
                        className="h-2/3 w-full pointer-events-auto"
                        title="点击查看大图"
                        onClick={() => onLightbox(img.data)}
                      />
                    </div>

                    {/* Checkbox Overlay (Circle) */}
                    <div className="absolute top-2 left-2 z-30 pointer-events-none">
                      {img.selected ? (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg border-2 border-white/30 animate-in zoom-in-50">
                          {order && order > 0 ? order : ""}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-white/50 bg-black/20 backdrop-blur-md"></div>
                      )}
                    </div>

                    {/* Drag Handle Indicator */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                      <GripVertical size={14} className="text-white" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Trash Bin */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverTrash(true);
          }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={handleDropToTrash}
          className={`w-16 h-full min-h-[144px] rounded-3xl flex flex-col items-center justify-center border-2 border-dashed transition-all duration-300 sticky top-0 ${
            isOverTrash
              ? "bg-red-500/20 border-red-500 scale-110 shadow-lg shadow-red-500/20 text-red-500"
              : darkMode
              ? "bg-slate-900/40 border-slate-800 text-slate-600"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}
        >
          <Trash2 size={24} className={isOverTrash ? "animate-bounce" : ""} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-2 text-center px-1">
            拖拽到此删除
          </span>
        </div>
      </div>
    </section>
  );
}
