import "./reader.css";
import "./precise.css";
import { PrecisePdfReader } from "@/components/precise-pdf-reader"; export default async function ReaderPage({ params }: { params: Promise<{ libraryId: string; driveFileId: string }> }) { const { libraryId, driveFileId } = await params; return <PrecisePdfReader driveFileId={driveFileId} libraryId={libraryId} />; }
