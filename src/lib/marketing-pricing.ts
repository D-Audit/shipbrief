export const marketingPlans = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    detail: "For product teams building a clear, trusted release habit.",
    features: ["100 published releases each month", "One product workspace", "Hosted public changelog", "Feedback collection"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    detail: "For teams that want every release to reach the right customers.",
    features: ["Unlimited published releases", "AI Studio and review workflow", "Changelog, email, and in-app", "Engagement analytics and signals"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 149,
    detail: "For cross-functional teams coordinating a broader product story.",
    features: ["Everything in Pro", "Advanced audience targeting", "Custom domains", "Priority support"],
  },
] as const;

export type MarketingPlanId = (typeof marketingPlans)[number]["id"];
