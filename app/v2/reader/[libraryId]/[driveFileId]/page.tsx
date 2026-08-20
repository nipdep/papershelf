import "./reader.css";
import { PdfReader } from "@/components/pdf-reader"; export default async function ReaderPage({ params }: { params: Promise<{ libraryId: string; driveFileId: string }> }) { const { libraryId, driveFileId } = await params; return <PdfReader driveFileId={driveFileId} libraryId={libraryId} />; }
