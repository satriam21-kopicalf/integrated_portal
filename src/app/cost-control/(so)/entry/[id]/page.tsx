"use client";

// The count form of a branch that Cost Control fills in on its behalf (D-56): the same screen as the crew uses.

import { useParams } from "next/navigation";
import CountView from "@/so/features/count/CountView";

export default function EntryCountPage() {
  const { id } = useParams<{ id: string }>();
  return <CountView countId={id} backHref="/cost-control/entry" />;
}
