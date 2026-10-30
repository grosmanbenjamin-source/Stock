import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import History from "./pages/History";
import PointsOfSale from "./pages/PointsOfSale";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen grid place-items-center text-[#758277]">Chargement…</div>;
  if (user === false) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/ventes" element={<Protected><Sales /></Protected>} />
          <Route path="/historique" element={<Protected><History /></Protected>} />
          <Route path="/points-de-vente" element={<Protected><PointsOfSale /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;
