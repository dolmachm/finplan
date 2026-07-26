import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ФИНКОН — персональное финансовое планирование",
    short_name: "ФИНКОН",
    description:
      "Доходы и расходы, чистые активы, цели и прогноз риска.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f9",
    theme_color: "#1a3b5d",
    lang: "ru",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
