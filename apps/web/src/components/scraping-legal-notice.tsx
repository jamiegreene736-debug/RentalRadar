import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrapingLegalNoticeResponse } from "@/lib/types";

export function ScrapingLegalNotice({ notice }: { notice: ScrapingLegalNoticeResponse }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <CardTitle>Scraping Notice</CardTitle>
        </div>
        <CardDescription>{notice.body}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <div className="grid gap-2">
          {notice.commitments.slice(0, 3).map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="border-t pt-3">
          <p>{notice.user_responsibilities[0]}</p>
        </div>
      </CardContent>
    </Card>
  );
}
