import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./styles/globals.css";

// Views
import { OverlayView } from "./views/OverlayView";
import { RegionSelectView } from "./views/RegionSelectView";
import { SettingsView } from "./views/SettingsView";
import { DragWidgetView } from "./views/DragWidgetView";
import { UploadWidgetView } from "./views/UploadWidgetView";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayView />} />
        <Route path="/region-select" element={<RegionSelectView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/drag-widget" element={<DragWidgetView />} />
        <Route path="/upload-widget" element={<UploadWidgetView />} />
        <Route path="*" element={<OverlayView />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
