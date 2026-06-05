import { describe, expect, it } from "vitest";

import {
  buildFolderPath,
  buildPaperPath,
  parseDriveFolderInput,
  titleFromFileName
} from "@/lib/utils/drive";

describe("drive utils", () => {
  it("extracts folder ids from Drive URLs", () => {
    expect(
      parseDriveFolderInput("https://drive.google.com/drive/folders/abc123_DEF")
    ).toBe("abc123_DEF");
  });

  it("keeps raw ids intact", () => {
    expect(parseDriveFolderInput("folder-id")).toBe("folder-id");
  });

  it("builds nested paths", () => {
    expect(buildFolderPath("/", "ML")).toBe("/ML");
    expect(buildFolderPath("/ML", "Transformers")).toBe("/ML/Transformers");
    expect(buildPaperPath("/ML", "paper.pdf")).toBe("/ML/paper.pdf");
  });

  it("derives titles conservatively from filenames", () => {
    expect(titleFromFileName("Attention_Is_All_You_Need.pdf")).toBe(
      "Attention Is All You Need"
    );
  });
});
