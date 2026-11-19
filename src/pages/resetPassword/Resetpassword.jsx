import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/Passwordreset';
import "../../App.css";

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = location.state?.resetToken;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Opening this page directly (or refreshing it) means there is no token.
  if (!resetToken && !done) return <Navigate to="/forgot-password" replace />;

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await resetPassword(resetToken, password,confirm);
      sessionStorage.removeItem('resetEmail');
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Password updated</h1>
          <p className="auth-lead">You can now sign in with your new password.</p>
          <Link className="auth-button-link" to="/login">Go to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-progress">Step 3 of 3</p>
        <h1>Set a new password</h1>
        <p className="auth-lead">Choose a password you have not used before.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={tooShort}
          />
          {tooShort && <p className="auth-hint error">Use at least {MIN_LENGTH} characters.</p>}

          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
          />
          {mismatch && <p className="auth-hint error">Passwords do not match.</p>}

          <label className="auth-check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={!canSubmit}>
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  );
}