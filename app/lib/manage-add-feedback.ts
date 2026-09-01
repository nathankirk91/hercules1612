export type ManageSuccessAction = {
  ok: true;
  intent?: string;
  message?: string;
};

export type ManageActionData =
  | ManageSuccessAction
  | { error: string }
  | undefined;

export const MANAGE_ADD_INTENT_TOAST: Record<string, string> = {
  "add-section": "Section added",
  "add-question": "Question added",
};

export function isManageAddIntent(intent: string | undefined) {
  return intent === "add-section" || intent === "add-question";
}

export function shouldShowInlineManageMessage(actionData: ManageActionData) {
  return (
    !!actionData &&
    "message" in actionData &&
    !!actionData.message &&
    !isManageAddIntent(actionData.intent)
  );
}

export function getManageAddToastMessage(intent: string | undefined) {
  if (!intent) {
    return null;
  }
  return MANAGE_ADD_INTENT_TOAST[intent] ?? null;
}
