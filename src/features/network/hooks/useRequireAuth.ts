import { useEffect } from "react";
import { useNetwork } from "../adapter/context";

/** Redirects to the host sign-in once we know nobody is signed in. Returns true while the screen may render. */
export function useRequireAuth(returnTo: string): boolean {
  const { adapter, user, userLoaded } = useNetwork();
  const needsAuth = userLoaded && !user;
  useEffect(() => {
    if (needsAuth) adapter.requireAuth(returnTo);
  }, [needsAuth, adapter, returnTo]);
  return userLoaded && !!user;
}
