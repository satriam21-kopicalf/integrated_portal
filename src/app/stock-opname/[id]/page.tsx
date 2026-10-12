"use client";

import { useParams } from "next/navigation";
import CountView from "@/so/features/count/CountView";

export default function CountPage() {
  const { id } = useParams<{ id: string }>();
  return <CountView countId={id} />;
}
