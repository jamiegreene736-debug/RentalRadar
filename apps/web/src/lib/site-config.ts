export const getStartedHref = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/dashboard";
export const hasClerkSignUp = Boolean(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL);
