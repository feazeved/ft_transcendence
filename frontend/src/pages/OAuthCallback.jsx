import { useEffect } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/api.js";
import { useAuth } from "@/lib/auth.jsx";

// Landed on after a Google/42 redirect completes on the backend (see
// AccountAdapter.get_login_redirect_url). The provider handshake already
// signed us into a Django session; we just need to fetch who that is and
// finish the same login() the email/password flow does.
function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    let cancelled = false;

    api
      .get("/auth/user/")
      .then((user) => {
        if (cancelled) return;
        login(user);
        navigate("/", { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        navigate("/login", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  return (
    <div className="flex-1 text-white flex justify-center items-center">
      <p>Signing you in…</p>
    </div>
  );
}

export default OAuthCallback;
