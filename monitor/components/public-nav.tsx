import Link from "next/link";
import { Sprout } from "lucide-react";

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
      </div>
    </nav>
  );
}
