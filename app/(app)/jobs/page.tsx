'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { api, type JobSearchFilters, type LiveJobOpening, type ResumeSummary } from '@/lib/api';

type FilterKey = keyof JobSearchFilters;
type ActiveFilters = Partial<Record<FilterKey, string>>;

const FILTER_DEFINITIONS: Record<FilterKey, { label: string; placeholder: string }> = {
  title: { label: 'Job title', placeholder: 'e.g. Software Engineer' },
  location: { label: 'Location', placeholder: 'Start typing a city' },
  skills: { label: 'Job description', placeholder: 'e.g. Python' },
  company: { label: 'Company', placeholder: 'e.g. Stripe' },
  source: { label: 'Source', placeholder: 'e.g. LinkedIn' },
  workMode: { label: 'Work mode', placeholder: 'e.g. Remote' },
  posted: { label: 'Posted date', placeholder: 'e.g. Last 7 days' },
};

const DEFAULT_FILTERS: ActiveFilters = { posted: 'Last 7 days' };
const FIXED_SUGGESTIONS: Partial<Record<FilterKey, string[]>> = {
  posted: ['Today', 'Last 2 days', 'Last 7 days', 'Last 30 days'],
  workMode: ['Remote', 'Hybrid', 'On-site'],
};

export default function JobsPage() {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [jobs, setJobs] = useState<LiveJobOpening[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [provider, setProvider] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [lastSearchMode, setLastSearchMode] = useState<'standard' | 'ai'>('standard');
  const [aiCriteria, setAiCriteria] = useState<string[]>([]);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.resumes
      .list()
      .then((items) => {
        setResumes(items);
        setResumeId(items[0]?.id || '');
      })
      .catch(() => setResumes([]));
  }, []);

  const selectedOpening = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;
  const availableFilters = (Object.keys(FILTER_DEFINITIONS) as FilterKey[]).filter((key) => activeFilters[key] === undefined);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !nextPageToken || loading || loadingMore || searchError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreJobs();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextPageToken, loading, loadingMore, searchError, jobs.length, lastSearchMode, resumeId, query, activeFilters]);

  async function performSearch(mode: 'standard' | 'ai') {
    if (mode === 'ai' && !resumeId) {
      toast.error('Choose a saved resume before searching with AI.');
      return;
    }

    const meaningfulFilters = Object.entries(cleanFilters(activeFilters)).some(([key]) => key !== 'posted');
    if (mode === 'standard' && !query.trim() && !meaningfulFilters) {
      toast.error('Enter a search term or add a job filter.');
      return;
    }

    setLoading(true);
    setSearchError('');
    setAiCriteria([]);
    try {
      const response = await api.jobSearch.search({
        query: query.trim() || undefined,
        filters: cleanFilters(activeFilters),
        mode,
        resumeId: mode === 'ai' ? resumeId : undefined,
      });
      setJobs(response.jobs);
      setProvider(response.provider);
      setNextPageToken(response.nextPageToken);
      setLastSearchMode(mode);
      setHasSearched(true);
      setSelectedId(response.jobs[0]?.id || '');
      setAiCriteria(response.aiCriteria?.skills ?? []);
    } catch (error) {
      setJobs([]);
      setNextPageToken(undefined);
      setHasSearched(true);
      setSearchError(error instanceof Error ? error.message : 'Live job search failed.');
    } finally {
      setLoading(false);
    }
  }

  function addFilter(key: FilterKey) {
    setActiveFilters((current) => ({ ...current, [key]: '' }));
    setFilterMenuOpen(false);
  }

  function updateFilter(key: FilterKey, value: string) {
    setActiveFilters((current) => ({ ...current, [key]: value }));
  }

  function removeFilter(key: FilterKey) {
    setActiveFilters((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function resetSearch() {
    setQuery('');
    setActiveFilters(DEFAULT_FILTERS);
    setFilterMenuOpen(false);
    setJobs([]);
    setSelectedId('');
    setSearchError('');
    setNextPageToken(undefined);
    setLastSearchMode('standard');
    setHasSearched(false);
    setAiCriteria([]);
  }

  async function loadMoreJobs() {
    if (!nextPageToken || loadingMore) return;

    setLoadingMore(true);
    setSearchError('');
    try {
      const response = await api.jobSearch.search({
        query: query.trim() || undefined,
        filters: cleanFilters(activeFilters),
        mode: lastSearchMode,
        resumeId: lastSearchMode === 'ai' ? resumeId : undefined,
        pageToken: nextPageToken,
      });
      setJobs((current) => mergeJobPages(current, response.jobs, lastSearchMode === 'ai'));
      setProvider(response.provider);
      setNextPageToken(response.nextPageToken);
      if (!selectedId && response.jobs[0]) {
        setSelectedId(response.jobs[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more jobs.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function saveOpening(opening: LiveJobOpening) {
    if (savedIds.includes(opening.id)) return;

    try {
      setSavingId(opening.id);
      await api.jobs.create({
        company_name: opening.company,
        job_title: opening.title,
        location: opening.location,
        source_platform: opening.source.slice(0, 40),
        application_link: opening.applyLink && opening.applyLink.length <= 500 ? opening.applyLink : undefined,
        status: 'saved',
      });
      setSavedIds((current) => [...current, opening.id]);
      toast.success('Saved to My Jobs.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this job.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="app-panel relative z-10 p-3">
        <div className="flex flex-col gap-2.5 xl:flex-row">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border px-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
            <Search size={16} className="shrink-0 text-[var(--text-muted)]" />
            <span className="sr-only">Search jobs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') performSearch('standard');
              }}
              placeholder="Search job title, skills, or company"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="flex h-11 min-w-[250px] items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
              <FileText size={15} className="shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">AI Resume</div>
                <select
                  value={resumeId}
                  onChange={(event) => setResumeId(event.target.value)}
                  aria-label="Resume for AI job search"
                  className="w-full bg-transparent text-xs font-medium text-[var(--text-primary)] outline-none"
                >
                  {!resumes.length && <option value="">No saved resume found</option>}
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>{resume.company_name} - {resume.job_title}</option>
                  ))}
                </select>
              </div>
            </label>
            <button type="button" onClick={() => performSearch('ai')} disabled={loading || !resumeId} className="app-button-primary h-11 gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-60">
              <Sparkles size={14} />
              Search with AI
            </button>
            <button type="button" onClick={() => performSearch('standard')} disabled={loading} className="app-button-secondary h-11 px-5 font-semibold text-[var(--text-primary)] disabled:opacity-60">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start gap-2">
          {(Object.entries(activeFilters) as Array<[FilterKey, string]>).map(([key, value]) => (
            <TypeaheadFilterChip
              key={key}
              filterKey={key}
              value={value}
              jobs={jobs}
              filters={activeFilters}
              onChange={updateFilter}
              onRemove={removeFilter}
            />
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen((current) => !current)}
              className="flex h-10 items-center gap-2 rounded-xl border border-dashed px-4 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-strong)' }}
              aria-expanded={filterMenuOpen}
            >
              <Plus size={15} />
              Add Filter
            </button>
            {filterMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-60 rounded-xl border p-2 shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-menu)' }}>
                <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Add filter</div>
                {availableFilters.length ? availableFilters.map((key) => (
                  <button key={key} type="button" onClick={() => addFilter(key)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                    {FILTER_DEFINITIONS[key].label}
                    <Plus size={13} />
                  </button>
                )) : (
                  <div className="px-3 py-2 text-xs text-[var(--text-muted)]">All filters are active.</div>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={resetSearch} className="ml-auto mt-3 px-2 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
            Reset
          </button>
        </div>
      </section>

      <section className="app-panel flex flex-wrap items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Job list</h2>
            <p className="text-xs text-[var(--text-muted)]">{loading ? 'Searching live jobs...' : hasSearched ? `${jobs.length} jobs found` : 'Run a live search to view jobs'}</p>
          </div>
          {provider && <span className="hidden rounded-lg border px-3 py-1.5 text-[11px] text-[var(--text-secondary)] sm:inline-flex" style={{ borderColor: 'var(--border-subtle)' }}>{provider}</span>}
          {aiCriteria.length > 0 && jobs[0]?.matchScore !== undefined && (
            <span className="hidden rounded-lg border px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-strong)] sm:inline-flex" style={{ borderColor: 'var(--border-strong)', background: 'var(--accent-soft)' }}>
              Top match {jobs[0].matchScore}%
            </span>
          )}
        </div>
        <div className="flex items-center rounded-lg p-1 text-xs font-medium" style={{ background: 'var(--bg-panel-muted)' }}>
          <span className="rounded-md bg-[var(--bg-panel)] px-3 py-1.5 text-[var(--text-primary)]">Search results <strong className="ml-1">{jobs.length}</strong></span>
          <span className="px-3 py-1.5 text-[var(--text-muted)]">Saved jobs {savedIds.length}</span>
        </div>
      </section>

      <section className="grid min-h-[610px] gap-3 xl:grid-cols-[minmax(365px,0.98fr)_minmax(500px,1.22fr)]">
        <div className="app-panel overflow-hidden">
          <div className="space-y-2 overflow-y-auto p-2 xl:max-h-[calc(100vh-284px)] xl:min-h-[610px]">
            {loading ? (
              <SearchState icon={<Sparkles size={23} />} title="Searching live job boards" body="Finding active opportunities from source-attributed listings." />
            ) : searchError ? (
              <SearchState icon={<SlidersHorizontal size={23} />} title="Live search unavailable" body={searchError} />
            ) : jobs.length ? (
              <>
                {jobs.map((opening, index) => (
                  <JobRow
                    key={opening.id}
                    opening={opening}
                    isTopMatch={Boolean(aiCriteria.length && index === 0 && opening.matchScore !== undefined)}
                    selected={selectedOpening?.id === opening.id}
                    saved={savedIds.includes(opening.id)}
                    saving={savingId === opening.id}
                    onSelect={setSelectedId}
                    onSave={saveOpening}
                  />
                ))}
                {nextPageToken && (
                  <div
                    ref={loadMoreSentinelRef}
                    className="flex w-full items-center justify-center rounded-xl border px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {loadingMore ? 'Loading more jobs...' : 'Scroll for more jobs'}
                  </div>
                )}
              </>
            ) : hasSearched ? (
              <SearchState icon={<Search size={23} />} title="No active jobs found" body="Broaden a filter or try a different search term." />
            ) : (
              <SearchState icon={<Search size={23} />} title="Search real job openings" body="Use filters or choose a resume for AI-assisted matching. Results display their originating job source." />
            )}
          </div>
        </div>

        {selectedOpening ? (
          <JobDetail
            opening={selectedOpening}
            isAiResult={Boolean(aiCriteria.length || selectedOpening.matchScore !== undefined)}
            saved={savedIds.includes(selectedOpening.id)}
            saving={savingId === selectedOpening.id}
            onSave={saveOpening}
          />
        ) : (
          <div className="app-panel flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><BriefcaseBusiness size={22} /></div>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">Job details appear here</h3>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--text-secondary)]">Select a fetched listing to see its live description, source, and apply action.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function TypeaheadFilterChip({
  filterKey,
  value,
  jobs,
  filters,
  onChange,
  onRemove,
}: {
  filterKey: FilterKey;
  value: string;
  jobs: LiveJobOpening[];
  filters: ActiveFilters;
  onChange: (key: FilterKey, value: string) => void;
  onRemove: (key: FilterKey) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const deferredValue = useDeferredValue(value.trim());
  const definition = FILTER_DEFINITIONS[filterKey];
  const suggestions = useMemo(
    () => {
      const localSuggestions = buildSuggestions(filterKey, deferredValue, jobs);
      return Array.from(new Set([...remoteSuggestions, ...localSuggestions])).slice(0, 5);
    },
    [deferredValue, filterKey, jobs, remoteSuggestions]
  );

  useEffect(() => {
    if (deferredValue.length < 2 || filterKey === 'posted' || filterKey === 'workMode') {
      setRemoteSuggestions([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timeoutId = window.setTimeout(() => {
      const lookup =
        filterKey === 'location'
          ? fetch(`/api/location-search?q=${encodeURIComponent(deferredValue)}`, { cache: 'no-store' })
              .then((response) => response.json())
              .then((data: { results?: Array<{ label: string }> }) => (data.results ?? []).map((item) => item.label))
          : api.jobSearch
              .suggestions({
                type: filterKey,
                query: deferredValue,
                filters: cleanFilters(Object.fromEntries(Object.entries(filters).filter(([key]) => key !== filterKey)) as ActiveFilters),
              })
              .then((data) => data.results);

      lookup
        .then((results) => {
          if (active) setRemoteSuggestions(results.slice(0, 5));
        })
        .catch(() => {
          if (active) setRemoteSuggestions([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [deferredValue, filterKey, filters]);

  return (
    <div className="relative flex h-10 items-center rounded-xl border pl-3 pr-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
      <span className="mr-1 whitespace-nowrap text-xs text-[var(--text-muted)]">{definition.label}:</span>
      <input
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => onChange(filterKey, event.target.value)}
        aria-label={`${definition.label} filter value`}
        placeholder={definition.placeholder}
        className="w-[142px] bg-transparent px-1 py-2 text-xs font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
      />
      <button type="button" onClick={() => onRemove(filterKey)} aria-label={`Remove ${definition.label} filter`} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)]">
        <X size={13} />
      </button>
      {focused && deferredValue.length >= 2 && (
        <div className="absolute left-0 top-[calc(100%+7px)] z-30 min-w-full overflow-hidden rounded-xl border shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-menu)' }}>
          {searching ? (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">Searching...</div>
          ) : suggestions.length ? suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                onChange(filterKey, suggestion);
                setFocused(false);
              }}
              className="block w-full border-b px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition last:border-b-0 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {suggestion}
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">No suggestions. Your typed value will still be used.</div>
          )}
        </div>
      )}
    </div>
  );
}

function JobRow({
  opening,
  isTopMatch,
  selected,
  saved,
  saving,
  onSelect,
  onSave,
}: {
  opening: LiveJobOpening;
  isTopMatch: boolean;
  selected: boolean;
  saved: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
  onSave: (opening: LiveJobOpening) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border transition" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-soft)' : 'var(--bg-panel)' }}>
      <button type="button" onClick={() => onSelect(opening.id)} className="block w-full px-3.5 pb-2.5 pt-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{opening.title}</h3>
              {isTopMatch && (
                <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                  Top match
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
              <span>{opening.company}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={11} />{opening.location}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{opening.postedAt}</span>
            </div>
          </div>
          {opening.matchScore !== undefined && (
            <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-right text-[11px] font-semibold text-[var(--accent-strong)]">
              {opening.matchScore}%
              <span className="block text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">match</span>
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-[18px] text-[var(--text-secondary)]">{opening.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded bg-[var(--bg-panel-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{opening.source}</span>
          {opening.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-[var(--bg-panel-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">{tag}</span>
          ))}
        </div>
      </button>
      <div className="flex items-center justify-between border-t px-3.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-[11px] text-[var(--text-muted)]">{opening.workMode} | {opening.salary}</span>
        <button type="button" onClick={() => onSave(opening)} disabled={saved || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] disabled:opacity-70">
          {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </article>
  );
}

function JobDetail({
  opening,
  isAiResult,
  saved,
  saving,
  onSave,
}: {
  opening: LiveJobOpening;
  isAiResult: boolean;
  saved: boolean;
  saving: boolean;
  onSave: (opening: LiveJobOpening) => void;
}) {
  return (
    <article className="app-panel overflow-hidden">
      <div className="px-5 py-5 text-white sm:px-6" style={{ background: 'var(--brand-gradient)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">{isAiResult ? 'AI resume match' : `Found via ${opening.source}`}</div>
        <div className="mt-2 flex items-start justify-between gap-5">
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">{opening.title}</h2>
          {opening.matchScore !== undefined && (
            <div className="rounded-xl bg-white/95 px-3.5 py-2 text-center text-[var(--accent-strong)]">
              <div className="text-lg font-bold">{opening.matchScore}%</div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em]">Fit</div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4 sm:px-6 xl:max-h-[calc(100vh-378px)] xl:min-h-[515px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{opening.company}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{opening.location}</span>
            <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={14} />{opening.employmentType}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{opening.postedAt}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSave(opening)} disabled={saved || saving} className="app-button-secondary h-9 gap-1.5 px-3 py-2 text-xs disabled:opacity-65">
              {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
              {saved ? 'Saved' : saving ? 'Saving...' : 'Save job'}
            </button>
            <Link href="/new-resume" className="app-button-primary h-9 gap-1.5 px-3 py-2 text-xs">
              <Wand2 size={13} />
              Tailor resume
            </Link>
          </div>
        </div>

        {opening.matchedKeywords.length > 0 && (
          <section className="border-b py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Matched keywords</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opening.matchedKeywords.map((keyword) => (
                <span key={keyword} className="rounded-lg border px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]" style={{ background: 'var(--accent-soft)', borderColor: 'var(--border-strong)' }}>{keyword}</span>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-5 py-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Job description</h3>
            <p className="mt-3 whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">{opening.description}</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-muted)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Source</div>
              <div className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{opening.source}</div>
              {opening.applyLink && (
                <a href={opening.applyLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]">
                  Apply on source
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            {opening.missingKeywords.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-muted)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Missing skills</div>
                <div className="mt-2 space-y-1.5">
                  {opening.missingKeywords.map((gap) => (
                    <div key={gap} className="rounded-lg border px-2.5 py-2 text-[11px] font-medium text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}>{gap}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

function SearchState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</div>
      <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function buildSuggestions(key: FilterKey, query: string, jobs: LiveJobOpening[]) {
  const normalizedQuery = query.toLowerCase();
  const values =
    FIXED_SUGGESTIONS[key] ??
    jobs.flatMap((job) => {
      if (key === 'title') return [job.title];
      if (key === 'company') return [job.company];
      if (key === 'source') return [job.source];
      if (key === 'skills') return job.tags;
      return [];
    });

  return Array.from(new Set(values))
    .filter((value) => !normalizedQuery || value.toLowerCase().includes(normalizedQuery))
    .slice(0, 5);
}

function cleanFilters(filters: ActiveFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value?.trim())) as JobSearchFilters;
}

function mergeJobPages(current: LiveJobOpening[], incoming: LiveJobOpening[], sortByMatch: boolean) {
  const byId = new Map<string, LiveJobOpening>();
  [...current, ...incoming].forEach((job) => {
    if (!byId.has(job.id)) {
      byId.set(job.id, job);
    }
  });

  const merged = Array.from(byId.values());
  return sortByMatch ? merged.sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0)) : merged;
}
