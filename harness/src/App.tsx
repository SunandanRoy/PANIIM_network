// HARNESS App.tsx, written the way a Lovable host's App.tsx looks after the three integration edits.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NetworkRoot, networkRoutes } from "@/network.routes"; // host edit 2
import NetworkPage from "./pages/NetworkPage";
import SignIn from "./pages/SignIn";

export default function App() {
  return (
    <BrowserRouter>
      <NetworkRoot>
        <Routes>
          <Route path="/" element={<Navigate to="/network" replace />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/auth" element={<SignIn />} />
          {networkRoutes()}
          <Route path="*" element={<p className="p-6">Not found</p>} />
        </Routes>
      </NetworkRoot>
    </BrowserRouter>
  );
}
