"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/insights", label: "Insights" },
  { href: "/agencies", label: "Agencies" },
  { href: "/datasets", label: "Datasets" },
  { href: "/trends", label: "Trends" },
  { href: "/login", label: "Auth" }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium transition",
              active ? "bg-white text-slate-900" : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
