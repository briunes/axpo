import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXPO Simulator",
    short_name: "AXPO Simulator",
    description: "AXPO Simulador de Ofertas",
    start_url: "/internal/login",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff3254",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
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
