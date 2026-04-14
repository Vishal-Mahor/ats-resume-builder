import type { ReactNode } from 'react';
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  FileText,
  LayoutTemplate,
  MessageSquareQuote,
  Rocket,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WandSparkles,
} from 'lucide-react';

export type MarketingNavItem = {
  href: string;
  label: string;
};

export const marketingNavItems: MarketingNavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const heroStats = [
  { value: '20+', label: 'resume generations every month on Plus' },
  { value: '30', label: 'job description analyses included on Plus' },
  { value: '1', label: 'workspace for every role, draft, and export' },
];

export const featureCards: Array<{
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    title: 'AI resume tailoring',
    description: 'Generate role-specific resumes that speak directly to the job description instead of sending the same draft everywhere.',
    icon: <WandSparkles className="h-5 w-5" />,
  },
  {
    title: 'ATS keyword checks',
    description: 'See alignment gaps, missing skills, and optimization signals before you submit the application.',
    icon: <ScanSearch className="h-5 w-5" />,
  },
  {
    title: 'Cover letter support',
    description: 'Create matching cover letter content alongside each resume so your application package stays consistent.',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: 'Template system',
    description: 'Choose layouts built for readability and recruiter scanning without giving up polish.',
    icon: <LayoutTemplate className="h-5 w-5" />,
  },
  {
    title: 'Application analytics',
    description: 'Track generated resumes, usage patterns, and document momentum from a single dashboard.',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: 'Secure profile reuse',
    description: 'Save your core profile data once and reuse it across multiple job applications with less friction.',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

export const workflowSteps = [
  {
    step: '01',
    title: 'Add your profile once',
    body: 'Store experience, projects, skills, and achievements so every new application starts with a strong base.',
  },
  {
    step: '02',
    title: 'Paste the target job description',
    body: 'The platform reads the role, extracts signals, and maps your background against the hiring intent.',
  },
  {
    step: '03',
    title: 'Generate tailored assets',
    body: 'Create a resume, analyze ATS fit, and prepare a cleaner application package in one flow.',
  },
  {
    step: '04',
    title: 'Track and improve',
    body: 'Keep your drafts, exports, and usage history organized so you can iterate faster for the next opportunity.',
  },
];

export const pricingPlans = [
  {
    name: 'Free',
    price: 'Rs 0',
    period: '/month',
    summary: 'A focused starting point for occasional applications.',
    features: [
      '1 resume generation per month',
      '1 JD analysis per month',
      'Unlimited profile and template access',
      'Resume history and dashboard access',
    ],
    cta: 'Start Free',
    href: '/auth/signin',
    featured: false,
  },
  {
    name: 'Plus',
    price: 'Rs 499',
    period: '/month',
    summary: 'Built for active job seekers tailoring applications at speed.',
    features: [
      '20 resume generations per month',
      '30 JD analyses per month',
      'Priority-ready workflow for multiple applications',
      'Everything in Free, with higher monthly limits',
    ],
    cta: 'Upgrade To Plus',
    href: '/auth/signin',
    featured: true,
  },
];

export const testimonials = [
  {
    quote: 'We stopped rebuilding every resume from scratch. The workflow feels like having an application strategist in the tab next to you.',
    name: 'Aarav S.',
    role: 'Product Analyst',
  },
  {
    quote: 'The ATS analysis helped me notice missing keywords early, and that alone made my applications much sharper.',
    name: 'Neha P.',
    role: 'Frontend Engineer',
  },
  {
    quote: 'I like that the product is practical. It saves drafts, tracks usage, and keeps the whole process organized instead of chaotic.',
    name: 'Ritika M.',
    role: 'Operations Lead',
  },
];

export const aboutPrinciples = [
  {
    title: 'Clarity over guesswork',
    description: 'We want job seekers to understand why a resume is stronger, not just click a magic button and hope.',
    icon: <Target className="h-5 w-5" />,
  },
  {
    title: 'Speed with structure',
    description: 'Applications move fast, so the product is designed to reduce repetitive work without losing quality.',
    icon: <Rocket className="h-5 w-5" />,
  },
  {
    title: 'Built around real hiring friction',
    description: 'From ATS filters to recruiter skim-reading, every part of the platform is shaped by real application bottlenecks.',
    icon: <BriefcaseBusiness className="h-5 w-5" />,
  },
];

export const featureHighlights = [
  {
    title: 'Resume generation tied to job intent',
    body: 'Create resumes against a specific role instead of maintaining disconnected versions across folders and tabs.',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: 'JD analysis before submission',
    body: 'Understand keyword fit, role coverage, and possible improvements before sending the application.',
    icon: <BadgeCheck className="h-5 w-5" />,
  },
  {
    title: 'Reusable candidate profile',
    body: 'Keep career history, education, projects, links, and achievements in one place for faster iteration.',
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Context-rich application workspace',
    body: 'Templates, resume history, analytics, billing, and support all live in the same product environment.',
    icon: <MessageSquareQuote className="h-5 w-5" />,
  },
];

export const contactReasons = [
  'Ask about product setup or onboarding',
  'Discuss billing or plan questions',
  'Report a workflow issue or bug',
  'Share a feature request for your hiring use case',
];
