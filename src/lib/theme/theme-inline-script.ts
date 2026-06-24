import { AKILIRISK_THEME_STORAGE_KEY } from "./constants";

/**
 * Runs before first paint to avoid light/dark flash. Keep in sync with ThemeProvider.
 * When `data-tenant-force-light="true"` on `<html>`, public tenant surfaces always load light.
 */
export function getThemeInlineScript(): string {
  const key = JSON.stringify(AKILIRISK_THEME_STORAGE_KEY);
  return `(()=>{try{var r=document.documentElement;if(r.dataset.tenantForceLight==="true"){r.classList.remove("dark");return;}var k=${key};var s=localStorage.getItem(k);if(s==="dark"){r.classList.add("dark");}else if(s==="light"){r.classList.remove("dark");}else{if(window.matchMedia("(prefers-color-scheme: dark)").matches){r.classList.add("dark");}else{r.classList.remove("dark");}}}catch(e){}})();`;
}
