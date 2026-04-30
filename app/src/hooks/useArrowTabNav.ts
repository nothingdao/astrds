import { useEffect } from "react";

export function useArrowTabNav<T extends string>(
  tabs: T[],
  active: T,
  setActive: (tab: T) => void
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = tabs.indexOf(active);
      if (idx === -1) return;
      const next =
        e.key === "ArrowRight"
          ? (idx + 1) % tabs.length
          : (idx - 1 + tabs.length) % tabs.length;
      setActive(tabs[next]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tabs, active, setActive]);
}
