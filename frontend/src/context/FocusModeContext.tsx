"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface FocusModeContextValue {
  isFocused: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  isFocused: false,
  enter: () => {},
  exit: () => {},
  toggle: () => {},
});

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [isFocused, setIsFocused] = useState(false);
  const enter  = useCallback(() => setIsFocused(true),  []);
  const exit   = useCallback(() => setIsFocused(false), []);
  const toggle = useCallback(() => setIsFocused((v) => !v), []);
  return (
    <FocusModeContext.Provider value={{ isFocused, enter, exit, toggle }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  return useContext(FocusModeContext);
}
