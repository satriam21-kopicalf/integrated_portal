"use client";

// What each figure of Aggregator Insight means: the ⓘ next to its label (2026-11-25).

import InfoTip from "@/components/ui/InfoTip";

type T = { title: string; definition: string[]; source: string[]; formula?: string[] };
const BOT = "BotFood, which reads the delivery apps about every hour", ESB = "ESB POS bills of GoFood, GrabFood and ShopeeFood", OURS = "Entered by the team in this portal", BILLS = "The first POS order of the platform on that day";
const INFO = {
  onTime: { title: "On time, at least", formula: ["On time ÷ outlet-days counted × 100"], definition: ["An outlet on one platform on one day counts as one outlet-day.", "On time = open before the opening hour plus the grace.", "At least: BotFood may see an opening up to an hour late.", "The opening hours are those of the merchant app: as the team checked, else as BotFood read them that day."], source: [BOT, BILLS] },
  late: { title: "Late, at most", definition: ["Seen open after the opening hour plus the grace.", "Proven by orders = the first POS order also came after it."], source: [BOT, BILLS] },
  notOpened: { title: "Not opened", definition: ["Not seen open and no POS order on the whole day."], source: [BOT, BILLS] },
  early: { title: "Closed early", definition: ["Closed before the closing hour and not open again; the last order counts as still open.", "At most: BotFood may see a closing up to an hour late or early."], source: [BOT, BILLS] },
  pause: { title: "Paused in all", definition: ["The minutes closed between two open stretches inside the opening hours."], source: [BOT] },
  oosNow: { title: "Items out now", definition: ["Each item × outlet × platform that is out now.", "Items inactive for a long time are switched off, not out of stock: left out."], source: [BOT] },
  oosTimes: { title: "Times out in the period", definition: ["How often an item went out of stock in the period."], source: [BOT] },
  oosAvg: { title: "Average time out", formula: ["Minutes out ÷ items of an outlet that went out"], definition: ["Only the minutes inside the opening hours; outlets without hours count day and night."], source: [BOT] },
  reviews: { title: "Reviews", definition: ["Every review of the period, with or without a comment.", "The day is the order day when known, otherwise the day BotFood received it."], source: [BOT] },
  rating: { title: "Average rating", definition: ["The plain average of the stars of the period."], source: [BOT] },
  low: { title: "Low (3 or less)", definition: ["Reviews of 1, 2 or 3 stars; each should become a complaint ticket."], source: [BOT] },
  response: { title: "Median first response", definition: ["From the ticket made until its status first changes; the middle value of all tickets answered."], source: [OURS] },
  voidPct: { title: "Void % of the orders", formula: ["Void orders ÷ (orders finished + void orders) × 100"], definition: ["Void and cancelled bills of the delivery apps."], source: [ESB] },
  voidReason: { title: "Without a reason", definition: ["ESB gives no reason for a void; the team fills it in here."], source: [ESB, OURS] },
  missing: { title: "Menus missing at an outlet", definition: ["A menu at least 80% of the outlets of the platform have and this outlet does not."], source: [BOT] },
  spread: { title: "Menus with different prices", definition: ["The usual price is the one most outlets of the platform have; any other price counts as different."], source: [BOT] },
  handled: { title: "Handled", definition: ["Outlets with a member on this date: the weekly schedule, changed by the exceptions of the date."], source: [OURS] },
  lift: { title: "Strength", formula: ["Share of the menu here ÷ its share on the other channels"], definition: ["1.3× or more sells clearly better here, 0.7× or less worse."], source: [ESB] },
} satisfies Record<string, T>;
export const Tip = ({ k }: { k: keyof typeof INFO }) => <InfoTip info={INFO[k] as never} />;
