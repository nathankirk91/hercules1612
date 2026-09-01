export type ManageSuccessAction = {
  ok: true;
  intent?: string;
  message?: string;
};

export type ManageActionData =
  | ManageSuccessAction
  | { error: string }
  | undefined;

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
