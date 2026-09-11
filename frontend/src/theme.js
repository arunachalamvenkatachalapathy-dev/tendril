import { useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'cosmic',
    name: 'Cosmic Obsidian',
    label: 'Default',
    inspiration: 'Tendril & Deep Space',
    accent: '#a8c7fa',
    canvasBg: '#131314',
    surfaceBg: '#1e1f20',
    description: 'Deep midnight space with celestial blue accents',
  },
  {
    id: 'nordic',
    name: 'Nordic Slate',
    label: 'Minimalist',
    inspiration: 'Craft & Arctic Twilight',
    accent: '#818cf8',
    canvasBg: '#0b0f17',
    surfaceBg: '#131b28',
    description: 'Cool Scandinavian slate with arctic periwinkle glow',
  },
];

export function applyTheme(themeId) {
  const valid = THEMES.some(t => t.id === themeId) ? themeId : 'cosmic';
  document.documentElement.setAttribute('data-theme', valid);
  try {
    localStorage.setItem('tendril_global_theme', valid);
  } catch (e) {}
  return valid;
}

export function saveUserTheme(uid, themeId) {
  if (!uid) return;
  try {
    localStorage.setItem('tendril_user_theme_' + uid, themeId);
    applyTheme(themeId);
  } catch (e) {}
}

export function getUserTheme(uid) {
  try {
    if (uid) {
      const userTheme = localStorage.getItem('tendril_user_theme_' + uid);
      if (userTheme && THEMES.some(t => t.id === userTheme)) return userTheme;
    }
    const globalTheme = localStorage.getItem('tendril_global_theme');
    if (globalTheme && THEMES.some(t => t.id === globalTheme)) return globalTheme;
    return 'cosmic';
  } catch (e) {
    return 'cosmic';
  }
}

/**
 * Hook to manage theme for current user
 */
export function useTheme(uid) {
  const [currentTheme, setCurrentTheme] = useState(() => getUserTheme(uid));

  useEffect(() => {
    const themeToApply = getUserTheme(uid);
    setCurrentTheme(themeToApply);
    applyTheme(themeToApply);
  }, [uid]);

  const selectTheme = (newThemeId) => {
    setCurrentTheme(newThemeId);
    applyTheme(newThemeId);
    if (uid) {
      saveUserTheme(uid, newThemeId);
    }
  };

  return [currentTheme, selectTheme];
}
