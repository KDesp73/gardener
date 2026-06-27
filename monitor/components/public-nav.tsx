import Link from "next/link";
import { Sprout, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  return (
    <nav className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground"
        >
          <Sprout className="h-6 w-6 text-primary" />
          Gardener
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}
