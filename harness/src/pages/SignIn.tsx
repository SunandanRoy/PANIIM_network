// HARNESS ONLY: pick a demo person instead of the host's real sign-in.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL, devAuth } from "../network.adapter";

interface DemoUser { id: string; name: string; institute: string | null; is_presenter: boolean; staff: boolean }

export default function SignIn() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => { fetch(`${API_URL}/harness/users`).then((r) => r.json()).then(setUsers, () => setUsers([])); }, []);
  const pick = async (id: string) => {
    await devAuth.signIn(id);
    navigate(sp.get("redirect") || "/network", { replace: true });
  };
  const featured = users.filter((u) => /Demo You|Meera|Arjun|Desk|Organiser|Unbound|Kavya|Tenzin/.test(u.name));
  return (
    <main className="mx-auto max-w-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dev harness</p>
      <h1 className="text-3xl font-bold">Sign in as</h1>
      <p className="mt-1 text-sm text-muted-foreground">Stands in for the host's sign-in. Demo data only.</p>
      {devAuth.userId() && <button className="mt-3 min-h-11 underline" onClick={() => { devAuth.signOut(); navigate("/network"); }}>Sign out</button>}
      <ul className="mt-4 space-y-2">
        {featured.map((u) => (
          <li key={u.id}>
            <button data-testid={`signin-${u.name}`} onClick={() => pick(u.id)} className="flex min-h-12 w-full items-center justify-between rounded-xl border bg-card px-4 text-left">
              <span className="font-semibold">{u.name}</span>
              <span className="text-sm text-muted-foreground">{u.staff ? "staff" : u.is_presenter ? "presenter" : "delegate"}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
