import { useEffect, useState } from "react";

/**
 * Lightweight media query hook. Returns `true` when the provided query matches.
 */
export function useMediaQuery(query: string): boolean {
  const getIsMatch = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [isMatch, setIsMatch] = useState<boolean>(getIsMatch);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQueryList = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => setIsMatch(event.matches);
    setIsMatch(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return isMatch;
}
