import { SignIn } from "./sign-in";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; loggedOut?: string }>;
}) {
  const p = await searchParams;
  return (
    <SignIn
      error={p.error === "access" ? "access" : p.error ? "failed" : ""}
      loggedOut={p.loggedOut === "1"}
    />
  );
}
