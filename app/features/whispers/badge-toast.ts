// "Badge earned: ..." toasts for the badges a comment or a love just earned (comments-10, first-love), as the old whispers page did.
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "~/components/Toast";

export function useBadgeToast() {
  const { t } = useTranslation();
  return useCallback(
    (ids: readonly string[] | null | undefined) => {
      if (!ids?.length) return;
      const badges = t("badges", { returnObjects: true }) as Record<string, readonly string[]>;
      const nameOf = (id: string) => badges[id]?.[0] || id;
      toast(ids.map((id) => t("badgeUnlocked", { name: nameOf(id) })));
    },
    [t],
  );
}
