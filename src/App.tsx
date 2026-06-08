import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { AdminPage } from "./pages/AdminPage";
import { DigestsPage } from "./pages/DigestsPage";
import { LoginPage } from "./pages/LoginPage";
import { RedditNewsPage } from "./pages/RedditNewsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/digests" replace />} />
        <Route path="/digests" element={<DigestsPage />} />
        <Route path="/digests/:date" element={<DigestsPage />} />
        <Route path="/reddit" element={<RedditNewsPage />} />
        <Route path="/feeds" element={<Navigate to="/admin" replace />} />
        <Route path="/settings" element={<Navigate to="/admin" replace />} />
        <Route
          path="/admin"
          element={(
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          )}
        />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
