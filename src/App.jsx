// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { AuthProvider } from "./context/AuthProvider";
// import Login from "./pages/Login";
// import Dashboards from "./pages/Dashboard/Dashboards";
// import ChangePassword from "./pages/ChangePassword";
// import ProtectedRoute from "./routes/ProtectedRoute";
// import ForgotPassword from './pages/resetPassword/ForgotPassword';
// import Verifyotp from './pages/resetPassword/Verifyotp';
// import Resetpassword from './pages/resetPassword/Resetpassword';

// const App = () => {
//   return (
//     <BrowserRouter>
//       <AuthProvider>
//         <Routes>
//           <Route path="/" element={<Login />} />
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
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </AuthProvider>
//       <Routes>
//         {/* your existing routes, e.g. <Route path="/login" element={<Login />} /> */}
//         <Route path="/forgot-password" element={<ForgotPassword />} />
//         <Route path="/verify-otp" element={<Verifyotp />} />
//         <Route path="/reset-password" element={<Resetpassword />} />
//       </Routes>
//     </BrowserRouter>
//   );
// };

// export default App;


import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import Login from "./pages/Login";
import Dashboards from "./pages/Dashboard/Dashboards";
import ChangePassword from "./pages/ChangePassword";
import ProtectedRoute from "./routes/ProtectedRoute";
import ForgotPassword from "./pages/resetPassword/ForgotPassword";
import Verifyotp from "./pages/resetPassword/Verifyotp";
import Resetpassword from "./pages/resetPassword/Resetpassword";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />

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
          <Route
            path="/change-password"
            element={<Navigate to="/changePassword" replace />}
          />
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
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

