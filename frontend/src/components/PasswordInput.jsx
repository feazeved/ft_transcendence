import { useState } from "react";
import eyeClose from "../assets/eye-closed.svg";
import eyeOpen from "../assets/eye-open.svg";

const PasswordInput = ({
  value,
  onChange,
  label = "Password",
  name = "password",
  placeholder = "*********",
  required = true,
  className = "",
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex justify-between items-center gap-3">
      <div className="flex flex-col w-full">
        <p>{label}</p>
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          className={`outline-none rounded-xl py-3 w-full ${className}`}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="cursor-pointer"
      >
        <img
          src={showPassword ? eyeOpen : eyeClose}
          alt={showPassword ? "Hide password" : "Show password"}
          className="w-6"
        />
      </button>
    </div>
  );
};

export default PasswordInput;
