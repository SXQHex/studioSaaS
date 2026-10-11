"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

/**
 * GET form that keeps list filters in the URL (`?q=…&status=…`) so search, filtering and
 * pagination happen on the server. Selects submit on change; the text box submits on Enter.
 * Changing a filter always resets `page` because it is not part of the form.
 */
export function ListFilters({
  action,
  query,
  searchPlaceholder,
  searchLabel,
  searchIcon,
  children,
}: {
  action: string;
  query: string;
  searchPlaceholder: string;
  searchLabel: string;
  searchIcon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Form
      action={action}
      className="toolbar-filters"
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
      }}
    >
      <label className="search-box">
        {searchIcon ?? <Search size={16} />}
        <input name="q" defaultValue={query} placeholder={searchPlaceholder} aria-label={searchLabel} maxLength={80} />
      </label>
      {children}
    </Form>
  );
}
