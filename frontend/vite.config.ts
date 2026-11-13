import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// One shared .env at the project root. Vite only exposes variables that start with VITE_ to the browser.
export default defineConfig({ plugins: [react()], envDir: "..", server: { port: 5173 } });
