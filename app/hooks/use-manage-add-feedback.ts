import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  getManageAddToastMessage,
  type ManageActionData,
} from "~/lib/manage-add-feedback";

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

    const toastMessage = getManageAddToastMessage(actionData.intent);
    if (!toastMessage) {
      return;
    }

    processed.current = actionData;
    toast.success(toastMessage);

    if (actionData.intent === "add-section") {
      callbacksRef.current.onAddSection?.();
    } else if (actionData.intent === "add-question") {
      callbacksRef.current.onAddQuestion?.();
    }
  }, [actionData]);
}
