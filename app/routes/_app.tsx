// Wraps every page: things that run once per visit in the browser, and the toasts.
import { Outlet } from "react-router";
import { Toasts } from "~/components/Toast";
import { useFocusRings } from "~/components/FocusRings";
import { useFirstVisitLanguage } from "~/lib/lang-redirect";
import { useErrorReports } from "~/features/report/report";
import { useCosmetics } from "~/features/games/cosmetics-hook";
import { useAccountSync } from "~/features/account/useAccountSync";
import { UpdatePrompt } from "~/features/pwa/UpdatePrompt";

export default function AppLayout() {
  useFocusRings();
  useFirstVisitLanguage();
  useErrorReports();
  useCosmetics();
  useAccountSync();
  return (
    <>
      <Outlet />
      <Toasts />
      <UpdatePrompt />
    </>
  );
}
