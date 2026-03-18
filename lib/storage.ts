// localStorage 工具函数

/**
 * 从 localStorage 获取数据
 * @param key 存储键名
 * @param fallback 默认值
 * @returns 存储的值或默认值
 */
export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * 保存数据到 localStorage
 * @param key 存储键名
 * @param value 要存储的值
 */
export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
}

/**
 * 从 localStorage 删除数据
 * @param key 存储键名
 */
export function removeItem(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}
