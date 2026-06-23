import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AiChatProvider } from "./assistant/AiChatProvider";
import "./theme/finguide.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AiChatProvider>
          <App />
        </AiChatProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);