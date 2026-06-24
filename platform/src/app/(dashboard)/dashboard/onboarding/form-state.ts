export type OnboardingFormStatus = "idle" | "error" | "success";

export interface OnboardingFormState {
  status: OnboardingFormStatus;
  message: string;
  fieldErrors: Partial<Record<"brand" | "telegram" | "buffer", string>>;
}

export const initialOnboardingFormState: OnboardingFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
