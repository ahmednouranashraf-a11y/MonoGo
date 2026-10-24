import { useEffect, useState } from 'react';
import AdminOverview from '../components/AdminOverview';
import AnalyticsPanel from '../components/AnalyticsPanel';
import ComplaintsInbox from '../components/ComplaintsInbox';
import { useLanguage } from '../i18n/LanguageContext';
import { adminData, type DbProfile, type DbSubscription, type DbTicket } from '../lib/db';
import { formatDateTime, num } from '../lib/format';
import {
  categoryLabels,
  documentUrl,
  pendingRequests,
  reviewRequest,
  type PendingRequest,
} from '../lib/verification';
import '../styles/admin-tabs.css';

type AdminTab = 'overview' | 'analytics' | 'complaints' | 'verification';

type AdminDataState = { users: DbProfile[]; tickets: DbTicket[]; subscriptions: DbSubscription[] };

export default function AdminPage() {
  const { t, locale, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [data, setData] = useState<AdminDataState | null>(null);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>(() => {
    try {
      const saved = sessionStorage.getItem('admin_tab');
      return saved === 'analytics' || saved === 'complaints' || saved === 'verification' ? saved : 'overview';
    } catch {
      return 'overview';
    }
  });
  const chooseTab = (next: AdminTab) => {
    setTab(next);
    try {
      sessionStorage.setItem('admin_tab', next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    adminData().then(setData);
    void pendingRequests().then(setRequests);
  }, []);

  const openDocument = async (path: string) => {
    // Open the tab first so the browser doesn't block it, then point it at the short-lived link.
    const tab = window.open('', '_blank');
    const url = await documentUrl(path);
    if (url && tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      tab?.close();
      setReviewError(t('admin.docError'));
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setWorkingId(id);
    setReviewError(null);
    const result = await reviewRequest(id, approve);
    setWorkingId(null);
    if (result.ok) setRequests((current) => current.filter((r) => r.id !== id));
    else setReviewError(result.error ?? t('admin.opFailed'));
  };

  if (!data) {
    return (
      <div className="subpage">
        <p className="auth-sub">{t('common.loading')}</p>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; badge?: string }[] = [
    { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview' },
    { id: 'analytics', label: isAr ? 'التحليلات' : 'Analytics' },
    { id: 'complaints', label: isAr ? 'الشكاوي' : 'Complaints' },
    {
      id: 'verification',
      label: isAr ? 'طلبات التوثيق' : 'Verification',
      badge: requests.length > 0 ? num(requests.length, locale) : undefined,
    },
  ];

  return (
    <div className="subpage">
      <div className="page-heading">
        <span className="eyebrow green">{t('admin.eyebrow')}</span>
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.intro')}</p>
      </div>

      <div className="admin-tabs" role="tablist" aria-label={isAr ? 'أقسام لوحة الأدمن' : 'Admin sections'}>
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => chooseTab(item.id)}
          >
            {item.label}
            {item.badge ? <span className="admin-tab-badge">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && <AdminOverview data={data} />}

      {tab === 'analytics' && <AnalyticsPanel />}

      {tab === 'complaints' && <ComplaintsInbox />}

      {tab === 'verification' && (
        <div className="network-card">
          <h3>{t('admin.requests', { n: num(requests.length, locale) })}</h3>
          {requests.length === 0 ? (
            <p>{t('admin.noRequests')}</p>
          ) : (
            <ul className="gate-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{r.full_name}</strong>
                    <small>
                      {isAr
                        ? categoryLabels[r.category]
                        : r.category === 'senior'
                        ? 'Seniors (over 60)'
                        : 'People with disabilities'}{' '}
                      · {formatDateTime(r.created_at, locale)}
                    </small>
                  </div>
                  <button className="outline-button" onClick={() => openDocument(r.doc_path)}>
                    {t('admin.viewDoc')}
                  </button>
                  <button className="dark-button" disabled={workingId === r.id} onClick={() => decide(r.id, true)}>
                    {t('admin.approve')}
                  </button>
                  <button className="outline-button" disabled={workingId === r.id} onClick={() => decide(r.id, false)}>
                    {t('admin.reject')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {reviewError && <p className="gate-error">{reviewError}</p>}
        </div>
      )}
    </div>
  );
}
