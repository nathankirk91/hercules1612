import { useEffect, useRef } from "react";

import type { ManageActionData } from "~/lib/manage-add-feedback";

export type { ManageActionData, ManageSuccessAction } from "~/lib/manage-add-feedback";
export {
  isManageAddIntent,
  shouldShowInlineManageMessage,
} from "~/lib/manage-add-feedback";

export function useManageAddFeedback(
  actionData: ManageActionData,
  callbacks: {
    onAddSection?: () => void;
    onAddQuestion?: () => void;
  },
) {
  const processed = useRef<unknown>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!actionData || actionData === processed.current) {
      return;
    }
    if (!("ok" in actionData) || !actionData.ok || !actionData.intent) {
      return;
    }

    if (actionData.intent !== "add-section" && actionData.intent !== "add-question") {
      return;
    }

    processed.current = actionData;

    if (actionData.intent === "add-section") {
      callbacksRef.current.onAddSection?.();
    } else if (actionData.intent === "add-question") {
      callbacksRef.current.onAddQuestion?.();
    }
  }, [actionData]);
}
