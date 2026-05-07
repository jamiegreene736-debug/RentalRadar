const clerkSignUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL?.trim();
const isPlaceholderSignUpRoute = clerkSignUpUrl === "/sign-up" || clerkSignUpUrl === "/sign-up/";

export const hasClerkSignUp = Boolean(clerkSignUpUrl && !isPlaceholderSignUpRoute);
export const getStartedHref = hasClerkSignUp && clerkSignUpUrl ? clerkSignUpUrl : "/dashboard";
