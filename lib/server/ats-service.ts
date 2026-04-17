import type { ResumeContent, Suggestion } from '@/lib/api';
import { refreshResumeAtsAnalysis as refreshEvidenceBackedAtsAnalysis } from '@/lib/server/tailoring-pipeline';

export function refreshResumeAtsAnalysis(input: {
  resumeContent: ResumeContent;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
}) {
  return refreshEvidenceBackedAtsAnalysis(input);
}
