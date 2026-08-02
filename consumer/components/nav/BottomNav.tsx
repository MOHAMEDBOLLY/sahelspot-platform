"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { ROOT_TABS, isTabActive } from "@/lib/navigation";

/** The 5-tab root navigation.
 *
 * Rendered only by the root-tab layout, never by a screen. That is what makes
 * approved decision 6 structural rather than a convention: a pushed detail
 * screen lives in the `(push)` route group, which has no BottomNav in its
 * layout, so it cannot show one by accident. The Stitch Venue Details export
 * does show one — with *Explore* marked active, on a venue page — which is
 * exactly the class of bug this prevents.
 *
 * Above `md` this is replaced by a top nav (Phase 11); until then it is
 * mobile-only chrome. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around rounded-t-[24px] border-t border-outline-variant/20 bg-surface px-2 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)]"
    >
      {ROOT_TABS.map((tab) => {
        const active = isTabActive(tab.href, pathname);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
              active
                ? "text-primary"
                : "text-on-surface-variant opacity-70 hover:opacity-100 active:scale-90"
            }`}
            href={tab.href}
            key={tab.href}
          >
            <Icon filled={active} name={tab.icon} />
            <span className="text-xs font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
