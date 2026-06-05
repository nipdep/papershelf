import { describe, expect, it } from "vitest";

import type { DriveClient } from "@/lib/google/drive";
import { scanDriveLibrary } from "@/lib/server/scan-drive-library";

function createDriveClient(): DriveClient {
  return {
    async getFileMetadata(fileId) {
      return {
        id: fileId,
        name: "Root",
        mimeType: "application/vnd.google-apps.folder"
      };
    },
    async listFolderChildren(folderId, pageToken) {
      if (folderId === "root" && !pageToken) {
        return {
          items: [
            {
              id: "folder-ml",
              name: "ML",
              mimeType: "application/vnd.google-apps.folder"
            },
            {
              id: "paper-root",
              name: "Intro.pdf",
              mimeType: "application/pdf"
            },
            {
              id: "ignored",
              name: ".paper-manager",
              mimeType: "application/vnd.google-apps.folder"
            }
          ],
          nextPageToken: "page-2"
        };
      }
      if (folderId === "root" && pageToken === "page-2") {
        return {
          items: [
            {
              id: "note",
              name: "readme.txt",
              mimeType: "text/plain"
            }
          ]
        };
      }
      if (folderId === "folder-ml") {
        return {
          items: [
            {
              id: "paper-ml",
              name: "Attention_Is_All_You_Need.pdf",
              mimeType: "application/pdf"
            }
          ]
        };
      }
      return { items: [] };
    },
    async ensurePaperManagerFolder() {
      throw new Error("not used");
    },
    async uploadOrUpdateIndexSqlite() {
      throw new Error("not used");
    },
    async downloadIndexSqlite() {
      throw new Error("not used");
    },
    async readAppConfig() {
      throw new Error("not used");
    },
    async writeAppConfig() {
      throw new Error("not used");
    },
    async createFolder() {
      throw new Error("not used");
    },
    async uploadPdf() {
      throw new Error("not used");
    },
    async updatePaper() {
      throw new Error("not used");
    },
    async trashPaper() {
      throw new Error("not used");
    }
  };
}

describe("scanDriveLibrary", () => {
  it("recursively scans folders, handles pagination, and skips .paper-manager", async () => {
    const result = await scanDriveLibrary(createDriveClient(), "root");

    expect(result.folders.map((folder) => folder.path)).toEqual(["/", "/ML"]);
    expect(result.papers.map((paper) => paper.path)).toEqual([
      "/Intro.pdf",
      "/ML/Attention_Is_All_You_Need.pdf"
    ]);
  });
});
