"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronsUpDown, Download, LogOut, Menu, Music2, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTokenAuth, type TokenRole } from "@/lib/auth/token-auth";
import { cn } from "@/lib/utils/cn";
import { founderNav, staffNav, type WebNavSection } from "@/lib/config/web-nav";

// Always points at the VPS's own copy, never a relative same-origin path.
// This dashboard shell is served from two places — the VPS's Next.js server
// (where a relative path would work fine) and the Cloudflare Pages static
// frontend (where it would not: Cloudflare Pages has a hard 25MB per-file
// limit on static assets, and this APK is ~60MB, so it can never be shipped
// through Cloudflare's own asset pipeline at all). The VPS has no such
// limit and already serves the real file, so every visitor downloads from
// there regardless of which frontend rendered the button.
const APK_DOWNLOAD_URL = "https://148.113.52.88.nip.io/downloads/swar-mangal.apk";

interface WebShellProps {
  // `role` drives which shell this is. Nav config is resolved here from the
  // shared config instead of passed as a prop because icon components cannot
  // cross the server/client component boundary.
  role: TokenRole;
  children: React.ReactNode;
}

function Brand() {
  return (
    <Link
      href="#"
      onClick={(e) => e.preventDefault()}
      className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg"
      aria-label="Swar Mangal home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dash-accent/30 bg-dash-accent/10 text-dash-accent">
        <Music2 className="h-4 w-4" aria-hidden />
      </span>
      <span className="font-display text-base tracking-[0.08em] text-dash-fg">Swar Mangal</span>
    </Link>
  );
}

function NavList({
  sections,
  pathname,
  onNavigate,
}: {
  sections: WebNavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Primary" className="space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/35">
            {section.label}
          </p>
          <ul className="mt-1 space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60",
                      active
                        ? "bg-dash-accent/10 text-dash-accent"
                        : "text-dash-fg/65 hover:bg-dash-fg/[0.05] hover:text-dash-fg",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function BranchSelector({ branches }: { branches: string[] }) {
  const [branch, setBranch] = React.useState("ALL");

  React.useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("branch");
    if (b && branches.includes(b)) setBranch(b);
  }, [branches]);

  React.useEffect(() => {
    if (branch === "ALL") return;
    const url = new URL(window.location.href);
    url.searchParams.set("branch", branch);
    window.history.replaceState(null, "", url);
  }, [branch]);

  const label = branch === "ALL" ? "All Branches" : branch;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-dash-fg/15 bg-dash-fg/[0.04] px-3 py-1.5 text-xs font-medium text-dash-fg/85 transition-colors hover:border-dash-accent/40 hover:text-dash-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
          aria-label={`Selected branch: ${label}. Change branch`}
        >
          <Building2 className="h-3.5 w-3.5 text-dash-fg/40" aria-hidden />
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-dash-fg/30" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] bg-dash-elevated border-dash-fg/10">
        <DropdownMenuRadioGroup value={branch} onValueChange={setBranch}>
          <DropdownMenuRadioItem value="ALL" className="text-dash-fg/85 focus:bg-dash-fg/[0.06]">
            All Branches
          </DropdownMenuRadioItem>
          {branches.map((b) => (
            <DropdownMenuRadioItem key={b} value={b} className="text-dash-fg/85 focus:bg-dash-fg/[0.06]">
              {b}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WebShell({ role, children }: WebShellProps) {
  const { session, isLoading, logout } = useTokenAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const sections = role === "FOUNDER_ADMIN" ? founderNav : staffNav;

  React.useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.role !== role) {
      router.replace(session.role === "FOUNDER_ADMIN" ? "/founder" : "/staff");
      return;
    }
  }, [isLoading, session, role, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  };

  if (isLoading || !session) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-dash-bg">
        <Skeleton className="h-16 rounded-none bg-dash-fg/[0.03] lg:hidden" />
        <div className="flex flex-1">
          <Skeleton className="hidden w-60 rounded-none bg-dash-fg/[0.03] lg:block" />
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-8 w-56 bg-dash-fg/[0.05]" />
            <Skeleton className="h-40 w-full bg-dash-fg/[0.05]" />
            <Skeleton className="h-40 w-full bg-dash-fg/[0.05]" />
          </div>
        </div>
      </div>
    );
  }

  const branches = session.branches ?? [];
  const activeItem = sections
    .flatMap((s) => s.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const pageTitle = activeItem?.title ?? "Dashboard";

  const drawerNav = (
    <div className="flex h-full flex-col p-5">
      <div className="mb-6 flex items-center justify-between">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="rounded-lg p-1.5 text-dash-fg/60 transition-colors hover:bg-dash-fg/[0.06] hover:text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto no-scrollbar pr-1">
        <NavList sections={sections} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </div>
      <div className="mt-6 border-t border-dash-fg/10 pt-4">
        <div className="flex items-center gap-3 px-1">
          <Avatar name={session.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-dash-fg">{session.name}</p>
            <p className="truncate text-xs text-dash-fg/45">{session.email}</p>
          </div>
          <ThemeToggle className="text-dash-fg/60 hover:bg-dash-fg/[0.06] hover:text-dash-fg" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-dash-bg text-dash-fg">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-dash-fg/10 bg-dash-sidebar lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3">
          <NavList sections={sections} pathname={pathname} />
        </div>
        <div className="border-t border-dash-fg/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={session.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-dash-fg">{session.name}</p>
              <p className="truncate text-xs text-dash-fg/45">{session.email}</p>
            </div>
            <ThemeToggle className="text-dash-fg/60 hover:bg-dash-fg/[0.06] hover:text-dash-fg" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            loading={signingOut}
            className="mt-3 w-full justify-start gap-2 rounded-xl px-3 text-dash-fg/55 hover:bg-dash-fg/[0.05] hover:text-red-300"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          hideClose
          className="fixed inset-y-0 left-0 top-0 h-dvh max-h-none w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 border-r border-dash-fg/10 bg-dash-sidebar p-0 shadow-2xl"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          {drawerNav}
        </DialogContent>
      </Dialog>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-dash-fg/10 bg-dash-bg/80 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-dash-fg/70 transition-colors hover:bg-dash-fg/[0.06] hover:text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-[15px] font-semibold tracking-tight">{pageTitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="hidden items-center gap-2 rounded-full border border-dash-fg/15 bg-dash-fg/[0.04] px-3 py-1.5 text-xs font-medium text-dash-fg/85 transition-colors hover:border-dash-accent/40 hover:text-dash-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 sm:flex"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              <span>Download APK</span>
            </a>
            <a
              href={APK_DOWNLOAD_URL}
              download
              aria-label="Download the Swar Mangal app (APK)"
              className="flex items-center justify-center rounded-full border border-dash-fg/15 bg-dash-fg/[0.04] p-2 text-dash-fg/85 transition-colors hover:border-dash-accent/40 hover:text-dash-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 sm:hidden"
            >
              <Download className="h-4 w-4" aria-hidden />
            </a>
            {branches.length > 1 && <BranchSelector branches={branches} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 lg:hidden"
                  aria-label="Account menu"
                >
                  <Avatar name={session.name} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-dash-elevated border-dash-fg/10">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium text-dash-fg">{session.name}</p>
                  <p className="text-xs font-normal text-dash-fg/45">{session.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleSignOut}
                  disabled={signingOut}
                  className="text-red-300 focus:bg-dash-fg/[0.06] focus:text-red-300"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto page-scroll">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}