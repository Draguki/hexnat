// app/page.jsx
// Root route — redirects straight to the dashboard.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
