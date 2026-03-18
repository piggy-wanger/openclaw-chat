"use client";

import { useState, useEffect, useCallback } from "react";
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

export function useDraft() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

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

  // 组件挂载时从 localStorage 恢复草稿
  useEffect(() => {
    const savedDraft = getItem<Draft>(DRAFT_KEY, EMPTY_DRAFT);
    if (savedDraft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(savedDraft);
    }
  }, []);

  // 草稿变化时保存到 localStorage
  useEffect(() => {
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
