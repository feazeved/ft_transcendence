import { useState } from "react";
import { Link } from "react-router";
import eyeClose from "../assets/eye-closed.svg"
import eyeOpen from "../assets/eye-open.svg"
import ft from "../assets/42.svg"

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      localStorage.setItem("token", data.token);
      console.log("Login successful:", data);
      navigate("/");
      window.location.reload();
    } catch (err) {
      console.error("Error during login:", err.message);
      setError("Login failed. Please check your connection and try again.");
    }
  };

	return (
		<>
		<section className="flex-1 text-white flex justify-center items-center">
	  <div
	    className="lg:backdrop-blur-lg w-[100vw] max-w-sm min-w-[500px] p-4 rounded-xl shadow-lg shadow-black  border-2 border-transparent"
	  >
        <h1 className="">
          Welcome back
        </h1>
        <div className="flex flex-col ">
          <form action="POST">
            <div className="flex flex-col gap-5 my-3">
              <div className="flex justify-between items-center gap-3">
                <input
                  type="email"
                  placeholder="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="outline-none rounded-xl p-3 w-full"
                />
                <div className="w-6"></div>
              </div>

              <div className="flex justify-between items-center gap-3">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="*********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="outline-none rounded-xl p-3 w-full"
                />
                <span
                  onClick={togglePasswordVisibility}
                  className="cursor-pointer"
                >
                  {showPassword ? (
                    <img
                      src={eyeOpen}
                      alt="Show password"
                      className="w-6"
                    />
                  ) : (
                    <img
                      src={eyeClose}
                      alt="Hide password"
                      className="w-6"
                    />
                  )}
                </span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="block w-full m-auto bg-black px-6 py-2 rounded-sm text-2xl mb-5 cursor-pointer
			  hover:shadow-[-4px_-4px_10px_0_#ef4444,4px_-4px_10px_0_#facc15,4px_4px_10px_0_#22c55e,-4px_4px_10px_0_#3b82f6] hover:scale-102"
            >
              Login with us
            </button>
            {error && (
              <p className="bg-red-600 w-fit p-4 rounded-xl mt-5">{error}</p>
            )}
          </form>
        </div>
				<div className="flex gap-3">
			<button
				id="google-login-btn"
				className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#3c4043] border border-[#747775] rounded h-10 px-4 font-medium text-sm
				hover:shadow-[-4px_-4px_10px_0_#ef4444,4px_-4px_10px_0_#facc15,4px_4px_10px_0_#22c55e,-4px_4px_10px_0_#3b82f6] hover:scale-105 cursor-pointer"
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
				id="fortyTwo-login-btn"
				className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#3c4043] border border-[#747775] rounded h-10 px-4 font-medium text-sm
				hover:shadow-[-4px_-4px_10px_0_#ef4444,4px_-4px_10px_0_#facc15,4px_4px_10px_0_#22c55e,-4px_4px_10px_0_#3b82f6] hover:scale-105 cursor-pointer"
			>
				<img src={ft} alt="forty two logo svg" className="w-[18px] h-[18px]" />
				Continue with 42
			</button>
		</div>
        <p className="mb-4 mt-8 text-center">
          Still do not have an account?
          <Link to="/register" className="px-4 font-bold">
            Register
          </Link>{" "}
        </p>
      </div>	
    </section>
	</>
	)
}

export default Login