import { ApplicationForm } from "./application-form";
export const metadata = {
  title: "Başvuru | FTK Studio",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main
      className="dashboard-content"
      style={{ maxWidth: 640, margin: "auto" }}
    >
      <ApplicationForm slug={slug} />
    </main>
  );
}
