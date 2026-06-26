"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sprout, LayoutDashboard, LogIn, LogOut } from "lucide-react";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Plants", icon: Sprout },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  const isLoginPage = pathname === "/login";

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Gardener
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            {links.map((link) => {
              const active = pathname === link.href
                || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoginPage ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Back
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
