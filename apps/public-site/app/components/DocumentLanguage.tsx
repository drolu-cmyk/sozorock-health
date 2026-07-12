"use client";

import { useEffect } from "react";

export function DocumentLanguage({ language }: { language: "en" | "es" }) {
  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;

    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [language]);

  return null;
}
