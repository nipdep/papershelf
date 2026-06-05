import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FolderTree } from "@/components/folder-tree";

describe("FolderTree", () => {
  it("renders nested folders", () => {
    render(
      <FolderTree
        currentFolderId="child"
        folders={[
          {
            driveFolderId: "root",
            parentFolderId: null,
            name: "Root",
            path: "/",
            depth: 0
          },
          {
            driveFolderId: "child",
            parentFolderId: "root",
            name: "ML",
            path: "/ML",
            depth: 1
          }
        ]}
        libraryId="root"
      />
    );

    expect(screen.getByText("All Papers")).toBeInTheDocument();
    expect(screen.getByText("ML")).toBeInTheDocument();
  });
});
