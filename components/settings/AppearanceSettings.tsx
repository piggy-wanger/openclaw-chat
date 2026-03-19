"use client";

import { useTheme } from "@/lib/theme/context";
import type { ThemeMode } from "@/lib/theme/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { FontSize } from "@/hooks/useSettings";

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

// Valid FontSize values for type guard
const VALID_FONT_SIZES = FONT_SIZE_OPTIONS.map((opt) => opt.value);

// Type guard for FontSize
function isValidFontSize(value: string | null): value is FontSize {
  return value !== null && VALID_FONT_SIZES.includes(value as FontSize);
}

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "亮色" },
  { value: "dark", label: "暗色" },
  { value: "system", label: "跟随系统" },
];

type AppearanceSettingsProps = {
  messageFontSize: FontSize;
  codeFontSize: FontSize;
  setSettings: (settings: { messageFontSize?: FontSize; codeFontSize?: FontSize }) => void;
};

export function AppearanceSettings({
  messageFontSize,
  codeFontSize,
  setSettings,
}: AppearanceSettingsProps) {
  const { families, familyId, setFamily, mode, setMode } = useTheme();

  const handleMessageFontSizeChange = (value: string | null) => {
    if (isValidFontSize(value)) {
      setSettings({ messageFontSize: value });
      toast.success("消息字体大小已保存");
    }
  };

  const handleCodeFontSizeChange = (value: string | null) => {
    if (isValidFontSize(value)) {
      setSettings({ codeFontSize: value });
      toast.success("代码块字体大小已保存");
    }
  };

  const handleFamilyChange = (id: string) => {
    setFamily(id);
    const family = families.find((f) => f.id === id);
    toast.success(`主题已切换为 ${family?.label || id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">外观设置</h2>
        <p className="text-sm text-zinc-500">自定义界面显示偏好</p>
      </div>

      {/* 主题配色选择 */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-300">主题配色</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {families.map((family) => {
            const isSelected = family.id === familyId;
            const preview = family.previewColors;

            return (
              <button
                key={family.id}
                onClick={() => handleFamilyChange(family.id)}
                className={`relative flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-zinc-400 bg-zinc-800/50"
                    : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50"
                }`}
              >
                {/* Preview color swatches */}
                {preview && (
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-5 h-5 rounded-sm"
                      style={{ backgroundColor: preview.primaryLight }}
                      title="Primary Light"
                    />
                    <div
                      className="w-5 h-5 rounded-sm"
                      style={{ backgroundColor: preview.primaryDark }}
                      title="Primary Dark"
                    />
                    <div
                      className="w-5 h-5 rounded-sm"
                      style={{ backgroundColor: preview.accentLight }}
                      title="Accent"
                    />
                    <div
                      className="w-5 h-5 rounded-sm"
                      style={{ backgroundColor: preview.backgroundLight }}
                      title="Background"
                    />
                  </div>
                )}
                <span className="text-sm font-medium text-zinc-200">{family.label}</span>
                {family.description && (
                  <span className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                    {family.description}
                  </span>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-zinc-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 模式切换 */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-300">显示模式</label>
        <div className="flex gap-2">
          {MODE_OPTIONS.map((opt) => {
            const isActive = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`px-4 py-2 text-sm rounded-md border transition-all ${
                  isActive
                    ? "bg-zinc-700 border-zinc-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 消息字体大小 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">消息字体大小</label>
        <Select value={messageFontSize} onValueChange={handleMessageFontSizeChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 代码块字体大小 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">代码块字体大小</label>
        <Select value={codeFontSize} onValueChange={handleCodeFontSizeChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
