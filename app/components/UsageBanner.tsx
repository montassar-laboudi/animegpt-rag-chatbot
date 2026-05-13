'use client';
import { signIn } from 'next-auth/react';

interface Props {
  remaining: number;
}

export default function UsageBanner({ remaining }: Props) {
  return (
    <div className="usage-banner">
      <span>
        ✦ {remaining} free question{remaining !== 1 ? 's' : ''} left
      </span>
      <button
        className="usage-banner-btn"
        onClick={() => signIn('google')}
      >
        Sign in to unlock unlimited
      </button>
    </div>
  );
}
