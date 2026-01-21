"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  title: string;
  href: string;
  items?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: "Getting Started",
    href: "/docs/getting-started",
  },
  {
    title: "Commands",
    href: "/docs/commands",
    items: [
      { title: "add", href: "/docs/commands/add" },
      { title: "install", href: "/docs/commands/install" },
      { title: "list", href: "/docs/commands/list" },
      { title: "remove", href: "/docs/commands/remove" },
      { title: "update", href: "/docs/commands/update" },
      { title: "source", href: "/docs/commands/source" },
    ],
  },
  {
    title: "Configuration",
    href: "/docs/configuration",
    items: [
      { title: "agpm.json", href: "/docs/configuration" },
      { title: "Lock File", href: "/docs/configuration/lock-file" },
    ],
  },
  {
    title: "Concepts",
    href: "/docs/concepts",
    items: [
      { title: "Sources", href: "/docs/concepts/sources" },
      { title: "Discovery", href: "/docs/concepts/discovery" },
      { title: "Collections", href: "/docs/concepts/collections" },
      { title: "Targets", href: "/docs/concepts/targets" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <ScrollArea className="h-full py-6 pr-6 lg:py-8">
      <nav className="space-y-8">
        {navigation.map((section) => (
          <div key={section.href} className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {section.items ? (
                section.title
              ) : (
                <Link
                  href={section.href}
                  className={cn(
                    "hover:text-foreground/80 transition-colors",
                    pathname === section.href && "text-primary"
                  )}
                >
                  {section.title}
                </Link>
              )}
            </h4>
            {section.items && (
              <ul className="space-y-2 border-l border-border ml-1 pl-4">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block text-sm py-0.5 transition-colors",
                        pathname === item.href
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}
