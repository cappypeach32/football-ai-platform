"use client";

import { useRef, useEffect, useState } from "react";

/**
 * Returns a flash class name ("value-flash-green" | "value-flash-red" | "")
 * whenever `value` changes. Direction depends on whether value went up or down.
 */
export function useValueFlash(value: number): string {
  const prev = useRef<number>(value);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (prev.current === value) return;
    const cls = value > prev.current ? "value-flash-green" : "value-flash-red";
    prev.current = value;
    setFlashClass(cls);
    const t = setTimeout(() => setFlashClass(""), 650);
    return () => clearTimeout(t);
  }, [value]);

  return flashClass;
}
