import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { DigestDetailPage } from "./pages/DigestDetailPage";
import { DigestsPage } from "./pages/DigestsPage";
import { FeedsPage } from "./pages/FeedsPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/digests" replace />} />
        <Route path="/digests" element={<DigestsPage />} />
        <Route path="/digests/:date" element={<DigestDetailPage />} />
        <Route path="/feeds" element={<FeedsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
