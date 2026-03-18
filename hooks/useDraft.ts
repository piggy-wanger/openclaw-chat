"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getItem, setItem, removeItem } from "@/lib/storage";
import { nanoid } from "nanoid";

const DRAFT_KEY = "openclaw-chat-draft";

export type DraftMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type Draft = {
  id: string;
  title: string;
  messages: DraftMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
} | null;

const EMPTY_DRAFT: Draft = null;

// 惰性初始化：从 localStorage 读取草稿
function loadDraftFromStorage(): Draft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  return getItem<Draft>(DRAFT_KEY, EMPTY_DRAFT);
}

export function useDraft() {
  // 使用惰性初始化读取 localStorage
  const [draft, setDraft] = useState<Draft>(loadDraftFromStorage);
  // 追踪是否是初始挂载，避免初始值触发保存
  const isInitialMount = useRef(true);

  // 保存草稿到 localStorage
  const saveDraft = useCallback((draftToSave: Draft) => {
    if (draftToSave) {
      setItem(DRAFT_KEY, {
        ...draftToSave,
        updatedAt: Date.now(),
      });
    }
  }, []);

  // 清除草稿
  const clearDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    removeItem(DRAFT_KEY);
  }, []);

  // 添加消息到草稿
  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const now = Date.now();

      setDraft((prevDraft) => {
        // 如果没有草稿，创建新的
        if (!prevDraft) {
          const newDraft: Draft = {
            id: `draft-${nanoid()}`,
            title: content.slice(0, 30) || "新草稿",
            messages: [
              {
                id: nanoid(),
                role,
                content,
                createdAt: now,
              },
            ],
            model: "claude-sonnet-4-6",
            createdAt: now,
            updatedAt: now,
          };
          saveDraft(newDraft);
          return newDraft;
        }

        // 添加消息到现有草稿
        const updatedDraft: Draft = {
          ...prevDraft,
          messages: [
            ...prevDraft.messages,
            {
              id: nanoid(),
              role,
              content,
              createdAt: now,
            },
          ],
          updatedAt: now,
        };
        saveDraft(updatedDraft);
        return updatedDraft;
      });
    },
    [saveDraft]
  );

  // 更新草稿标题
  const updateTitle = useCallback(
    (title: string) => {
      setDraft((prevDraft) => {
        if (!prevDraft) return prevDraft;
        const updatedDraft: Draft = {
          ...prevDraft,
          title,
          updatedAt: Date.now(),
        };
        saveDraft(updatedDraft);
        return updatedDraft;
      });
    },
    [saveDraft]
  );

  // 更新草稿模型
  const updateModel = useCallback(
    (model: string) => {
      setDraft((prevDraft) => {
        if (!prevDraft) return prevDraft;
        const updatedDraft: Draft = {
          ...prevDraft,
          model,
          updatedAt: Date.now(),
        };
        saveDraft(updatedDraft);
        return updatedDraft;
      });
    },
    [saveDraft]
  );

  // 草稿变化时保存到 localStorage（跳过初始挂载）
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (draft) {
      setItem(DRAFT_KEY, draft);
    }
  }, [draft]);

  return {
    draft,
    saveDraft,
    clearDraft,
    addMessage,
    updateTitle,
    updateModel,
  };
}
