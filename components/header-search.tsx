"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLibraryPage = pathname.startsWith("/library/");
  const action = isLibraryPage ? pathname : "/";
  const params = new URLSearchParams(searchParams.toString());
  const currentQuery = params.get("q") ?? "";
  params.delete("q");
  const [value, setValue] = useState(currentQuery);

  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) {
        nextParams.set("q", trimmed);
      } else {
        nextParams.delete("q");
      }
      const nextQuery = nextParams.toString();
      const nextUrl = nextQuery ? `${action}?${nextQuery}` : action;
      const currentUrl = searchParams.toString() ? `${action}?${searchParams.toString()}` : action;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl as never);
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [action, router, searchParams, value]);

  return (
    <form
      action={action}
      className="header-search"
      method="get"
      onSubmit={(event) => event.preventDefault()}
    >
      {Array.from(params.entries()).map(([key, value], index) => (
        <input key={`${key}-${index}`} name={key} type="hidden" value={value} />
      ))}
      <span className="header-search-icon" aria-hidden="true">
        /
      </span>
      <input
        onChange={(event) => setValue(event.target.value)}
        name="q"
        placeholder={isLibraryPage ? "Search papers in this library" : "Search libraries and papers"}
        value={value}
      />
    </form>
  );
}
