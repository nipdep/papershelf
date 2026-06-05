"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function HeaderSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLibraryPage = pathname.startsWith("/library/");
  const action = isLibraryPage ? pathname : "/";
  const params = new URLSearchParams(searchParams.toString());
  const currentQuery = params.get("q") ?? "";
  params.delete("q");

  return (
    <form action={action} className="header-search" method="get">
      {Array.from(params.entries()).map(([key, value], index) => (
        <input key={`${key}-${index}`} name={key} type="hidden" value={value} />
      ))}
      <span className="header-search-icon" aria-hidden="true">
        /
      </span>
      <input
        defaultValue={currentQuery}
        name="q"
        placeholder={isLibraryPage ? "Search papers in this library" : "Search libraries and papers"}
      />
    </form>
  );
}
