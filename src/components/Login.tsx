import React, { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import "./Login.css";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    try {
      setError("");
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch {
      setError("Failed to log in with Google");
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        <button
          className="login-button google"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
