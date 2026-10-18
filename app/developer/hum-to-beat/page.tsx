import { redirect } from "next/navigation";

export default function OwnerHumToBeatPage() {
  redirect("/hum-to-beat?owner=1");
}
