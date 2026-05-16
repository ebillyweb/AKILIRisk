import { AKILIRISK_THEME_STORAGE_KEY } from "./constants";

/**
 * Runs before first paint to avoid light/dark flash. Keep in sync with ThemeProvider.
 * Escaped for use in Next.js `dangerouslySetInnerHTML` inside a <script> tag.
 */
export function getThemeInlineScript(): string {
  const key = AKILIRISK_THEME_STORAGE_KEY;
  return `(()=>{try{var k=${JSON.stringify(key)};var s=localStorage.getItem(k);var r=document.documentElement;if(s==="dark"){r.classList.add("dark");}else if(s==="light"){r.classList.remove("dark");}else{if(window.matchMedia("(prefers-color-scheme: dark)").matches){r.classList.add("dark");}else{r.classList.remove("dark");}}}catch(e){}})();`;
}
