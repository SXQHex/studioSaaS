import Link from "next/link";
import { PAGE_SIZE, pageCount } from "@/lib/data/pagination";

function href(basePath: string, params: Record<string, string>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize = PAGE_SIZE,
}: {
  basePath: string;
  /** Active filters (q, status, …) to carry over to the page links. */
  params: Record<string, string>;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="table-toolbar" aria-label="Sayfalama">
      <p>
        {total} kaydın {from}–{to} arası · Sayfa {page} / {pages}
      </p>
      <div className="row-actions">
        {page > 1 ? (
          <Link className="secondary-action" href={href(basePath, params, page - 1)} rel="prev">
            Önceki
          </Link>
        ) : (
          <span className="secondary-action" aria-disabled="true">
            Önceki
          </span>
        )}
        {page < pages ? (
          <Link className="secondary-action" href={href(basePath, params, page + 1)} rel="next">
            Sonraki
          </Link>
        ) : (
          <span className="secondary-action" aria-disabled="true">
            Sonraki
          </span>
        )}
      </div>
    </nav>
  );
}
