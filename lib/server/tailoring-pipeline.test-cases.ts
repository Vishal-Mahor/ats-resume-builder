export const TAILORING_PIPELINE_TEST_CASES = [
  {
    id: 'strong-backend-match',
    description: 'Direct Python/FastAPI backend match with measurable API impact.',
    expected: [
      'strong requirement coverage',
      'no unsupported tools added',
      'rewritten bullets preserve explicit latency metric',
    ],
  },
  {
    id: 'partial-kafka-match',
    description: 'JD requires Kafka but candidate only has generic async event processing evidence.',
    expected: [
      'Kafka remains missing unless explicitly evidenced',
      'mapping marks partial or adjacent match',
      'suggestions recommend stronger proof instead of fabrication',
    ],
  },
  {
    id: 'keyword-stuffing-trap',
    description: 'JD repeats Agile heavily but candidate evidence is minimal.',
    expected: [
      'keyword alignment should not spike from repetition alone',
      'stuffing penalty should trigger on excessive Agile mentions',
      'final resume should stay readable',
    ],
  },
  {
    id: 'metric-fabrication-guard',
    description: 'Candidate says improved performance but gives no number.',
    expected: [
      'rewritten bullets must avoid invented percentages',
      'evidence strength should remain moderate, not perfect',
      'ATS suggestions may ask for stronger quantified evidence if available',
    ],
  },
  {
    id: 'seniority-gap',
    description: 'Junior candidate targeting senior backend role.',
    expected: [
      'summary stays modest and truthful',
      'ATS score reflects gap instead of inflated fit',
      'missing leadership or ownership requirements are surfaced',
    ],
  },
] as const;
