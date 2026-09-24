import { useCafeteriaNotice, type CafeteriaNoticeData } from '@/hooks/useCafeteriaNotice';

const TONE_CLASS: Record<CafeteriaNoticeData['tone'], string> = {
  closed: 'bg-red-700 text-white',
  busy: 'bg-amber-300 text-foreground-950',
};

export default function CafeteriaNotice({ className = '' }: { className?: string }) {
  const notice = useCafeteriaNotice();
  if (!notice) return null;

  return (
    <div role="status" aria-live="polite" className={`${TONE_CLASS[notice.tone]} ${className}`}>
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm font-semibold md:px-6">
        <i className={`${notice.icon} mt-0.5`} aria-hidden="true" />
        <span>{notice.text}</span>
      </p>
    </div>
  );
}
