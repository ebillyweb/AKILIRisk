"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { ContactForm } from "@/components/marketing/ContactForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getEnterpriseSalesContactEmail } from "@/lib/billing/enterprise-sales-contact";

export function EnterpriseSalesContactDialog({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const salesEmail = getEnterpriseSalesContactEmail();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={triggerClassName ?? "inline-flex w-full items-center justify-center gap-2"}
        >
          <Mail className="h-4 w-4" aria-hidden />
          Contact sales
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Contact sales</DialogTitle>
          <DialogDescription>
            Tell our sales team about your firm. We will reply to the email you provide,
            typically within one business day.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          intent="enterprise"
          audience="sales"
          embedded
          onSuccess={() => setOpen(false)}
        />
        <p className="text-xs text-muted-foreground">
          You can also reach us directly at{" "}
          <a href={`mailto:${salesEmail}`} className="text-primary hover:underline">
            {salesEmail}
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
