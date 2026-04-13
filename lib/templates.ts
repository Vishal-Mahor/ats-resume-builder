export type ResumeTemplate = {
  id: string;
  name: string;
  tag: string;
  usage: string;
  description: string;
  note: string;
  strengths: string[];
};

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'clarity',
    name: 'Clarity',
    tag: 'ATS-friendly',
    usage: 'Most used',
    description: 'Single-column structure with strict section order for predictable ATS parsing.',
    note: 'Balanced, ATS-friendly structure',
    strengths: ['Single-column flow', 'Keyword-dense summary', 'Simple reverse chronology'],
  },
  {
    id: 'operator',
    name: 'Operator',
    tag: 'Recommended',
    usage: 'Great for product and ops roles',
    description: 'Highlights impact metrics, ownership, and operational scale without heavy visuals.',
    note: 'Sharper emphasis on metrics and impact',
    strengths: ['Impact-first bullets', 'Execution-focused sections', 'Outcome-led hierarchy'],
  },
  {
    id: 'signal',
    name: 'Signal',
    tag: 'Modern',
    usage: 'Popular with tech applicants',
    description: 'Modern rhythm with clean spacing while keeping ATS-safe typography and labels.',
    note: 'Clean modern style for product and tech roles',
    strengths: ['Readable spacing', 'Compact skills stack', 'Recruiter-friendly scan flow'],
  },
  {
    id: 'navigator',
    name: 'Navigator',
    tag: 'ATS + Human-friendly',
    usage: 'Best for hybrid technical roles',
    description: 'ATS-safe one-column layout plus stronger recruiter scanning cues for faster review.',
    note: 'ATS-safe parsing with stronger visual readability cues',
    strengths: ['ATS-safe section labels', 'Clear role timeline', 'Skills grouped by domain'],
  },
];
