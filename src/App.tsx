import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/digests" replace />} />
      <Route path="/digests" element={<main>Digests</main>} />
      <Route path="/digests/:date" element={<main>Digest detail</main>} />
      <Route path="/feeds" element={<main>Feeds</main>} />
      <Route path="/settings" element={<main>Settings</main>} />
    </Routes>
  );
}
