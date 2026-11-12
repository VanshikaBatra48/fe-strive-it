// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { AuthProvider } from "./context/AuthProvider";
// import Login from "./pages/Login";
// import Dashboards from "./pages/Dashboard/Dashboards";
// import ChangePassword from "./pages/ChangePassword";
// import ProtectedRoute from "./routes/ProtectedRoute";
// import ForgotPassword from "./pages/resetPassword/ForgotPassword";
// import Verifyotp from "./pages/resetPassword/Verifyotp";
// import Resetpassword from "./pages/resetPassword/Resetpassword";
// import { NotificationProvider } from './context/NotificationContext';
// import { useAuth } from './context/AuthContext'; // CHANGE: your auth hook

// const App = () => {
//   return (
//     <BrowserRouter>
//       <AuthProvider>
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/login" element={<Navigate to="/" replace />} />

//           {/* Public password reset routes */}
//           <Route path="/forgot-password" element={<ForgotPassword />} />
//           <Route path="/verify-otp" element={<Verifyotp />} />
//           <Route path="/reset-password" element={<Resetpassword />} />

//           <Route
//             path="/changePassword"
//             element={
//               <ProtectedRoute>
//                 <ChangePassword />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/change-password"
//             element={<Navigate to="/changePassword" replace />}
//           />
//           <Route
//             path="/dashboard"
//             element={
//               <ProtectedRoute>
//                 <Dashboards />
//               </ProtectedRoute>
//             }
//           />

//           {/* Catch-all must stay last */}
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </AuthProvider>
//     </BrowserRouter>
//   );
// };


// export default App;


import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./hooks/useAuth";   // default export, in src/hooks/useAuth
//import { useAuth } from "./context/AuthContext"; // CHANGE: wherever useAuth is really exported
import { NotificationProvider } from "./context/NotificationContext";
import Login from "./pages/Login";
import Dashboards from "./pages/Dashboard/Dashboards";
import ChangePassword from "./pages/ChangePassword";
import ProtectedRoute from "./routes/ProtectedRoute";
import ForgotPassword from "./pages/resetPassword/ForgotPassword";
import Verifyotp from "./pages/resetPassword/Verifyotp";
import Resetpassword from "./pages/resetPassword/Resetpassword";

// Must be rendered INSIDE <AuthProvider>, because it reads the token from it
function NotificationRoot({ children }) {
  const { token } = useAuth();
  return <NotificationProvider token={token}>{children}</NotificationProvider>;
}

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationRoot>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* Public password reset routes */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<Verifyotp />} />
            <Route path="/reset-password" element={<Resetpassword />} />

            <Route
              path="/changePassword"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route path="/change-password" element={<Navigate to="/changePassword" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboards />
                </ProtectedRoute>
              }
            />

            {/* Catch-all must stay last */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationRoot>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;