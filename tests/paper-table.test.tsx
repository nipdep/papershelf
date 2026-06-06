import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaperTable } from "@/components/paper-table";

describe("PaperTable", () => {
  it("renders empty state", () => {
    render(<PaperTable canEdit={false} papers={[]} viewMode="list" />);
    expect(screen.getByText("No papers match this folder yet.")).toBeInTheDocument();
  });

  it("renders paper rows", () => {
    render(
      <PaperTable
        canEdit
        papers={[
          {
            driveFileId: "paper-1",
            driveFolderId: "lib",
            libraryId: "lib",
            libraryName: "Library",
            title: "Paper",
            fileName: "Paper.pdf",
            path: "/Paper.pdf",
            mimeType: "application/pdf",
            accessLevel: "restricted",
            indexedAt: "2026-01-01T00:00:00.000Z"
          }
        ]}
        showLibraryName
        viewMode="list"
      />
    );

    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
  });
});
