/** Remounts on every navigation, so each new page slides in from the right while fading up. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
