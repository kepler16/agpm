import Link from "next/link";
import { Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container py-8 md:py-12 px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span className="font-bold">AGPM</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Universal package manager for AI coding tool artifacts.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Documentation</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/docs/getting-started" className="hover:text-foreground">
                  Getting Started
                </Link>
              </li>
              <li>
                <Link href="/docs/commands" className="hover:text-foreground">
                  Commands
                </Link>
              </li>
              <li>
                <Link href="/docs/configuration" className="hover:text-foreground">
                  Configuration
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="https://github.com/kepler16/agpm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  GitHub
                </Link>
              </li>
              <li>
                <Link href="/schemas/agpm.json" className="hover:text-foreground">
                  JSON Schema
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="https://github.com/kepler16/agpm/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  MIT License
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kepler16. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
