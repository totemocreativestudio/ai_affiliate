/** Lumaway Tailwind-compatible token map.
 * This configuration mirrors the production CSS token system.
 * It is intentionally dependency-free today; activate it when Tailwind is added
 * to the build pipeline without changing the visual contract below.
 */
export default {
  content:[
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme:{
    extend:{
      colors:{
        lumaway:{
          navy:"#071431",
          ink:"#101828",
          violet:"#6658f4",
          purple:"#9658f6",
          blue:"#3478f6",
          cyan:"#20c8dc",
          pink:"#ef4bbd",
          orange:"#ff9f43",
          green:"#18b779",
          page:"#f7f8fc"
        }
      },
      borderRadius:{lumaway:"16px","lumaway-sm":"11px","lumaway-lg":"20px"},
      boxShadow:{
        lumaway:"0 18px 48px rgba(24,33,64,.07)",
        "lumaway-soft":"0 8px 28px rgba(24,33,64,.055)"
      },
      fontFamily:{sans:["DM Sans","Inter","ui-sans-serif","system-ui"]},
      transitionTimingFunction:{lumaway:"cubic-bezier(.22,.8,.32,1)"}
    }
  }
};
