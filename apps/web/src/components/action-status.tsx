"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button, ButtonProps } from "@/components/ui/button";

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
