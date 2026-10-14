import { revalidatePath } from "next/cache";
/** Revalidate related read models together after a studio mutation. */
export function revalidateStudioViews() {
  revalidatePath("/dashboard", "layout");
}
