import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";
import "./i18n/i18n";   // initialize react-i18next before any t() call

/* Wrapper order matters:
 *   ThemeProvider  → MUI theme + dark/light toggle context
 *   AuthProvider   → session state (uses MUI components for spinner)
 *   BrowserRouter  → routing
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
