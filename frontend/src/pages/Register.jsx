import { useState } from "react";
import { Link, useNavigate } from "react-router";
import PasswordInput from "../components/PasswordInput";
import { api } from "@/lib/api.js";

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
      await api.post("/auth/register/", { username, email, password });
      navigate("/login");
    } catch (err) {
      console.error("Error during register:", err.message);
      setError("Register failed. Please check your details and try again.");
    }
  };

  return (
    <section className="flex-1 flex items-center justify-center text-white">
      <div className="lg:backdrop-blur-lg w-screen max-w-sm min-w-125 p-4 rounded-xl shadow-lg shadow-black  border-2 border-transparent">
        <h1 className="text-xl text-center tracking-wide">
          Sign up
        </h1>

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
              className="block w-full m-auto bg-black px-6 py-2 rounded-sm text-2xl mb-5 cursor-pointer
			  hover:shadow-[-4px_-4px_10px_0_#ef4444,4px_-4px_10px_0_#facc15,4px_4px_10px_0_#22c55e,-4px_4px_10px_0_#3b82f6] hover:scale-102"
            >
              Register
            </button>
            {error && (
              <p className="bg-red-600 w-fit p-4 rounded-xl">{error}</p>
            )}
        </div>
        <p className="mb-4 mt-4 pl-1 text-center">
          Already have an account?
          <Link to="/login" className="ml-5 inline-block font-bold transition-transform hover:scale-110">
            Login
          </Link>
        </p>
      </div>
    </section>
  );
}

export default Register;