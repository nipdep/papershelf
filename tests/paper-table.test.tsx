import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaperTable } from "@/components/paper-table";

describe("PaperTable", () => {
  it("renders empty state", () => {
    render(<PaperTable canEdit={false} libraryId="lib" papers={[]} />);
    expect(screen.getByText("No papers match this view yet.")).toBeInTheDocument();
  });

  it("renders paper rows", () => {
    render(
      <PaperTable
        canEdit
        libraryId="lib"
        papers={[
          {
            driveFileId: "paper-1",
            driveFolderId: "lib",
            title: "Paper",
            fileName: "Paper.pdf",
            path: "/Paper.pdf",
            mimeType: "application/pdf",
            indexedAt: "2026-01-01T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(screen.getByText("Edit below")).toBeInTheDocument();
  });
});
