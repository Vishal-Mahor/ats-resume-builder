'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { BillingUsagePanel } from '@/components/billing/BillingUsagePanel';
import { api, type BillingSnapshot, type User } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    Promise.all([api.billing.get(), api.auth.me()])
      .then(([billingResult, userResult]) => {
        setBilling(billingResult);
        setUser(userResult);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load billing details.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const paymentLinkId =
      searchParams.get('razorpay_payment_link_id') ||
      searchParams.get('payment_link_id') ||
      searchParams.get('paymentLinkId');
    if (!paymentLinkId) return;

    let active = true;
    api.billing
      .confirmPlusPayment(paymentLinkId)
      .then((updated) => {
        if (!active) return;
        setBilling(updated);
        toast.success('Payment received. Pro plan activated.');
        router.replace('/billing');
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : 'Unable to verify payment status yet.');
      });

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  async function handleUpgrade() {
    if (billing?.plan === 'plus') return;

    setUpgrading(true);
    try {
      const checkout = await api.billing.createPlusCheckout();
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open payment gateway.');
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!billing) {
    return (
      <section className="app-panel p-8">
        <h2 className="app-subheading">Billing unavailable</h2>
        <p className="app-body mt-3">Unable to load your plan right now. Please retry in a moment.</p>
      </section>
    );
  }

  return (
    <BillingUsagePanel
      billing={billing}
      email={user?.email}
      onUpgrade={handleUpgrade}
      upgrading={upgrading}
    />
  );
}
