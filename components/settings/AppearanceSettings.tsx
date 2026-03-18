"use client";

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">外观设置</h2>
        <p className="text-sm text-zinc-500">自定义界面显示偏好</p>
      </div>

      {/* 主题选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">主题</label>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-sm px-3 py-2 bg-zinc-800 rounded-md border border-zinc-700">
            深色模式
          </span>
          <span className="text-xs text-zinc-500">(当前仅支持深色模式)</span>
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
