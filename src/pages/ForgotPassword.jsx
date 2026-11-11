import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authApi from "../api/authApi";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // 'email' | 'otp' | 'reset'
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(trimmedEmail);
      setSuccessMsg(
        res?.message ||
          "If an account exists with this email, a 6-digit verification OTP has been sent."
      );
      setStep("otp");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send reset OTP. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanedOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setError("Please enter the 6-digit numeric OTP sent to your email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.verifyResetOTP(email.trim().toLowerCase(), cleanedOtp);
      if (!res?.resetToken) {
        throw new Error("Verification did not return a reset token.");
      }
      setResetToken(res.resetToken);
      setSuccessMsg(res.message || "OTP verified! Set your new password below.");
      setStep("reset");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Invalid or expired OTP. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!newPassword || newPassword.length < 8 || newPassword.length > 72) {
      setError("Password must be between 8 and 72 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setSuccessMsg(
        res?.message || "Password reset successfully! Redirecting to sign in..."
      );
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to reset password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900 text-slate-100">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 p-6 sm:p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Reset Password
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === "email" && "Enter your email to receive a 6-digit reset OTP."}
              {step === "otp" && `Enter the 6-digit OTP sent to ${email}.`}
              {step === "reset" && "Create a strong new password for your account."}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {["email", "otp", "reset"].map((s, idx) => {
            const stepOrder = ["email", "otp", "reset"];
            const activeIdx = stepOrder.indexOf(step);
            const completedOrCurrent = idx <= activeIdx;
            return (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  completedOrCurrent ? "bg-blue-500" : "bg-slate-700"
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium">
            {successMsg}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? "Sending OTP..." : "Send Verification OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                6-Digit OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-3.5 py-2.5 border border-slate-700 rounded-lg text-sm tracking-widest font-mono text-white placeholder-slate-500 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
              >
                {submitting ? "Verifying..." : "Verify OTP"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError("");
                  setSuccessMsg("");
                  setOtp("");
                  setStep("email");
                }}
                className="py-2.5 px-3 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Resend
              </button>
            </div>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  New Password
                </label>
                <span className="text-[11px] text-slate-400">8–72 characters</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={72}
                  placeholder="Enter new password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-16 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                placeholder="Confirm new password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? "Resetting..." : "Update Password"}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <Link
            to="/"
            className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
          >
            &larr; Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

