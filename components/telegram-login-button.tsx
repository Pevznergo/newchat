"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function TelegramLoginButton({ botName }: { botName: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current || !botName) return;
    
    // Check if script already exists to avoid duplicates
    if (wrapperRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.async = true;

    wrapperRef.current.appendChild(script);

    // Define global callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      signIn("telegram-login", {
        callbackUrl: "/",
        ...user,
      });
    };

    return () => {
      // Cleanup unlikely needed for this script as it replaces itself, but good practice
      // (window as any).onTelegramAuth = undefined; 
    };
  }, [botName]);

  return <div ref={wrapperRef} className="flex justify-center" />;
}
