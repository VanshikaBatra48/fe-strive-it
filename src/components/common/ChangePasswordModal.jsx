import { useState } from "react";
import {     authApi } from "../../api/authApi";

const emptyForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordField({ label, value, onChange, show, onToggle, autoFocus }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          className="w-full px-3.5 py-2 pr-16 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setForm(emptyForm);
    setShow({ current: false, next: false, confirm: false });
    setError("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.newPassword.length < 8) {
      return setError("New password must be at least 8 characters.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError("New password and confirm password do not match.");
    }
    if (form.newPassword === form.currentPassword) {
      return setError("New password must be different from the current password.");
    }

    try {
      setLoading(true);
      const data = await authApi.updatePassword(form);
      if (data?.success === false) {
        return setError(data.message || "Failed to change password.");
     }
      setForm(emptyForm);
      setShow({ current: false, next: false, confirm: false });
      onSuccess?.(data?.message || "Password changed successfully!");
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to change password."
      );
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Change Password
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter your current password and choose a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <PasswordField
            label="Current Password"
            value={form.currentPassword}
            onChange={set("currentPassword")}
            show={show.current}
            onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
            autoFocus
          />
          <PasswordField
            label="New Password"
            value={form.newPassword}
            onChange={set("newPassword")}
            show={show.next}
            onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
          />
          <PasswordField
            label="Confirm New Password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            show={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
          />

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}