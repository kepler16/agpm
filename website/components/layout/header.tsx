import Link from "next/link";
import { Package } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/getting-started", label: "Quick Start" },
  { href: "https://github.com/kepler16/agpm", label: "GitHub", external: true },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 md:px-6 lg:px-8">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Package className="h-6 w-6" />
            <span className="font-bold">AGPM</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
            <div className="hidden md:block">
              <Button asChild size="sm">
                <Link href="/docs/getting-started">Get Started</Link>
              </Button>
            </div>
            <MobileNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
