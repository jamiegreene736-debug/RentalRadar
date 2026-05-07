import { redirect } from "next/navigation";

import { getStartedHref } from "@/lib/site-config";

export default function SignUpRedirectPage() {
  redirect(getStartedHref);
}
