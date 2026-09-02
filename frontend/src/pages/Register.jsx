import { useState } from "react";
import { Link, useNavigate } from "react-router";
import PasswordInput from "../components/PasswordInput";
import Section from "../components/Section";
import { api } from "@/lib/api.js";
import ft from "../assets/42.svg"

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear any previous errors

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await api.post("/auth/registration/", {
        username,
        email,
        password1: password,
        password2: confirmPassword,
      });
      navigate("/login");
    } catch (err) {
      setError(err.message || "Register failed. Please check your details and try again.");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center text-white">
      <Section title="Sign up" className="w-screen max-w-sm min-w-125">
        <div className="flex flex-col my-3 gap-4">
          <div>
            <p className="px-3">Username</p>
            <input
              type="text"
              placeholder="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className=" outline-none rounded-xl p-3 w-full"
            />
          </div>
          <div>
            <p className="px-3">Email</p>
            <input
              type="email"
              placeholder="player1@gmail.com"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="outline-none rounded-xl p-3 w-full"
            />
          </div>
          <div className="flex flex-col px-3">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}/>
          </div>
          <div className="flex flex-col px-3">
          <PasswordInput label="Confirm Password" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}/>
          </div>
            <button
              onClick={handleSubmit}
              className="block w-full m-auto bg-linear-to-r from-violet-700/60 to-cyan-400/60 px-6 py-2 rounded-sm text-xl cursor-pointer hover:scale-105"
            >
              Register
            </button>
            {error && (
              <p className="bg-red-600 w-fit p-4 rounded-xl">{error}</p>
            )}
        </div>
        <div className="flex gap-3 px-3">
          <button
            id="google-register-btn"
            type="button"
            onClick={() => { window.location.href = "/accounts/google/login/"; }}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#3c4043] border border-[#747775] rounded h-10 px-4 font-medium text-sm hover:scale-105 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://w3.org">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button
            id="fortyTwo-register-btn"
            type="button"
            onClick={() => { window.location.href = "/accounts/fortytwo/login/"; }}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#3c4043] border border-[#747775] rounded h-10 px-4 font-medium text-sm hover:scale-105 cursor-pointer"
          >
            <img src={ft} alt="forty two logo svg" className="w-4.5 h-4.5" />
            Continue with 42
          </button>
        </div>
        <p className="mb-4 mt-4 pl-1 text-center">
          <span>Already have an account?</span>
          <Link to="/login" className="ml-5 inline-block font-bold transition-transform hover:scale-110">
            Login
          </Link>
        </p>
      </Section>
    </div>
  );
}

export default Register;