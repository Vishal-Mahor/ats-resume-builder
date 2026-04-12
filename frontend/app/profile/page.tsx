'use client';
// app/profile/page.tsx
import { useEffect, useState } from 'react';
import { api, type FullProfile } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: '', location: '', linkedin: '', github: '', website: '', summary: '',
  });

  useEffect(() => {
    api.profile.get()
      .then(p => { setProfile(p); setForm({ phone: p.phone||'', location: p.location||'', linkedin: p.linkedin||'', github: p.github||'', website: p.website||'', summary: p.summary||'' }); })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.profile.update(form);
      toast.success('Profile saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl text-gray-900" style={{ fontFamily: 'Instrument Serif, serif' }}>Profile</h1>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 bg-emerald-700 text-white text-sm rounded-xl hover:bg-emerald-600 transition disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-800 mb-4">Contact Info</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Phone', key: 'phone', placeholder: '+91 98765 43210' },
            { label: 'Location', key: 'location', placeholder: 'Bengaluru, India' },
            { label: 'LinkedIn', key: 'linkedin', placeholder: 'linkedin.com/in/you' },
            { label: 'GitHub', key: 'github', placeholder: 'github.com/you' },
            { label: 'Website', key: 'website', placeholder: 'yoursite.com' },
          ].map(f => (
            <div key={f.key} className={f.key === 'website' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
              <input
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-800 mb-3">Professional Summary</h3>
        <textarea
          value={form.summary}
          onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
          rows={4}
          placeholder="A brief summary of your background and expertise..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition resize-y"
        />
        <p className="text-xs text-gray-400 mt-1.5">This is your base summary — AI will tailor it per job.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-2">Saved Data</h3>
        <p className="text-xs text-gray-400">
          Your profile stores <strong>{profile?.skills.length || 0}</strong> skills,{' '}
          <strong>{profile?.experiences.length || 0}</strong> experiences, and{' '}
          <strong>{profile?.projects.length || 0}</strong> projects.{' '}
          This data is reused across all resumes so you don't re-enter it every time.
        </p>
      </div>
    </div>
  );
}
