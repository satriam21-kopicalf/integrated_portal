// The four forms of the outlets / PICs and their monitoring pages (pages form.* and mon.*, lib/pages.ts). Skeleton:
// titles and the planned flow; the fields come once they are agreed.

import { MapPinCheck, Package, Store, Wrench } from "lucide-react";
import { ReactNode } from "react";
import { tr } from "@/lib/i18n";

export type FormKey = "pic-check-in" | "outlet" | "product" | "tools";

export const FORMS: Record<FormKey, {
  title: () => string; icon: ReactNode;
  form: { subtitle: () => string; steps: () => string[] };
  monitoring: { subtitle: () => string; steps: () => string[] };
}> = {
  "pic-check-in": {
    title: () => tr("PIC Check In"), icon: <MapPinCheck size={22} />,
    form: { subtitle: () => tr("Check in at the outlet you visit"), steps: () => [
      tr("Pick the outlet you are at"), tr("Take a selfie with the camera; time and location are recorded"), tr("Submit the check in, and check out when you leave"),
    ] },
    monitoring: { subtitle: () => tr("Check-ins of every PIC"), steps: () => [
      tr("Who checked in where and when, per day"), tr("Visits outside the outlet radius are flagged"), tr("Open a check in to see the photo and the location"),
    ] },
  },
  outlet: {
    title: () => tr("Monitoring Outlet"), icon: <Store size={22} />,
    form: { subtitle: () => tr("Fill in the outlet checklist"), steps: () => [
      tr("Pick the outlet and the day"), tr("Go through the checklist: cleanliness, display, service, team"), tr("Add photos of the findings and submit"),
    ] },
    monitoring: { subtitle: () => tr("Outlet checklists & findings"), steps: () => [
      tr("Score of every outlet per visit"), tr("Findings to follow up, with photos"), tr("Trend per outlet and per area"),
    ] },
  },
  product: {
    title: () => tr("Monitoring Product"), icon: <Package size={22} />,
    form: { subtitle: () => tr("Fill in the product checklist"), steps: () => [
      tr("Pick the outlet and the products checked"), tr("Check taste, look, temperature and storage per product"), tr("Add photos of the findings and submit"),
    ] },
    monitoring: { subtitle: () => tr("Product checklists & findings"), steps: () => [
      tr("Result of every product per outlet"), tr("Products below standard, with photos"), tr("Trend per product and per outlet"),
    ] },
  },
  tools: {
    title: () => tr("Tools & Heavy Tools"), icon: <Wrench size={22} />,
    form: { subtitle: () => tr("Report the condition of the tools"), steps: () => [
      tr("Pick the outlet and the tool (machine, grinder, chiller …)"), tr("Condition: good, needs service or broken, with a photo"), tr("Submit: the report is followed up until it is repaired"),
    ] },
    monitoring: { subtitle: () => tr("Condition & repairs per outlet"), steps: () => [
      tr("Condition of the tools of every outlet"), tr("Open reports and repairs in progress"), tr("History per tool"),
    ] },
  },
};

export const isFormKey = (v: string): v is FormKey => v in FORMS;
