import { requireViewer } from "@/lib/auth";
import { eventListItems, sharedEvents } from "@/lib/event-items";
import { PageHeader } from "@/components/page-header";
import { EventList } from "@/components/events/event-list";

export const metadata = { title: "Your projects" };

/** A guest's home: the published projects whose People list has their email. Members see these under Projects too. */
export default async function SharedPage() {
  const viewer = await requireViewer();
  const items = await eventListItems(viewer.supabase, await sharedEvents(viewer.supabase, viewer.orgs.map((o) => o.id)), () => false);
  return (
    <>
      <PageHeader title="Your projects" subtitle="Projects you were added to. Each one stays open to you until it is archived." />
      <EventList items={items} emptyTitle="Nothing shared with you right now" emptyBody="When someone adds you to a project, it appears here and in the project's chat. A project closes to guests once it is archived." />
    </>
  );
}
