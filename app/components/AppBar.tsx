// The title bar of an app page. With `back`, the arrow (and the title next to it) is one back link: it goes back in history when
// the visitor came from another page of this site, so that page comes back exactly as it was; otherwise it follows `back`.
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "./Icon";

export function AppBar({ title, back, backLabel, children }: { title?: ReactNode; back?: string; backLabel?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  // React Router marks the first page of a visit with key "default": there is nothing of ours to go back to.
  const cameFromHere = location.key !== "default";
  return (
    <header className="flex items-center gap-2.5 pt-3.5 pb-2">
      {back ? (
        <Link
          to={back}
          aria-label={backLabel}
          title={backLabel}
          onClick={(e) => {
            if (!cameFromHere) return;
            e.preventDefault();
            navigate(-1);
          }}
          className="-ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-xl py-1 pr-2 text-text no-underline hover:bg-white/8"
        >
          <Icon as={ArrowLeft} className="size-[1.6em]" />
          {title && <h1 className="m-0 min-w-0 truncate font-comic text-[1.6rem]">{title}</h1>}
        </Link>
      ) : (
        title && <h1 className="m-0 min-w-0 flex-1 font-comic text-[1.6rem]">{title}</h1>
      )}
      {children}
    </header>
  );
}
