import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppProvider } from "./state";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })}><AppProvider><App /></AppProvider></QueryClientProvider></React.StrictMode>
);
