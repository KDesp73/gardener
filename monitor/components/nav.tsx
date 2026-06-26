"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sprout, LogIn, LogOut } from "lucide-react";

export function Nav() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isDashboard = pathname.startsWith("/dashboard");

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground"
          >
            <Sprout className="h-5 w-5 text-primary" />
            Gardener
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center justify-center rounded-md px-2 py-2 text-sm transition-colors sm:gap-1.5 sm:px-3",
                isDashboard
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              aria-label="Dashboard"
            >
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isLoginPage ? (
            <Link
              href="/"
              className="flex items-center justify-center rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:gap-1.5 sm:px-3"
              aria-label="Back to home"
            >
              <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          ) : isDashboard ? (
            <button
              type="button"
              onClick={() => {
                fetch("/api/logout", { method: "POST" }).then(() => {
                  window.location.href = "/";
                });
              }}
              className="flex items-center justify-center rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:gap-1.5 sm:px-3"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:gap-1.5 sm:px-3"
              aria-label="Login"
            >
              <LogIn className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
