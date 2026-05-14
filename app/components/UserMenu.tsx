'use client';
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useProfile } from '@/lib/useProfile';
import ProfileModal from './ProfileModal';

interface Props {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  onSignOut?: () => void;
}

export default function UserMenu({ name, email, image, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { displayName, displayImage, save } = useProfile(name, image);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDeleteAccount = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    localStorage.clear();
    signOut({ callbackUrl: '/' });
  };

  const handleProfileSave = (newName: string, newImage?: string) => {
    save({ name: newName, ...(newImage ? { image: newImage } : {}) });
  };

  const firstName = displayName.split(' ')[0];

  return (
    <>
      <div className="user-menu-wrapper" ref={ref}>
        <button
          className="user-menu-trigger"
          onClick={() => { setOpen(o => !o); setConfirmDelete(false); }}
          aria-label="User menu"
          aria-expanded={open}
        >
          {displayImage ? (
            <img src={displayImage} alt={firstName} className="user-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="user-avatar-fallback">{displayName[0]?.toUpperCase() ?? 'U'}</div>
          )}
          <span className="user-menu-name">{firstName}</span>
          <svg
            className={`user-menu-chevron${open ? ' open' : ''}`}
            width="12" height="12" viewBox="0 0 12 12"
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor" strokeWidth="1.5"
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="user-dropdown">
            <div className="user-dropdown-profile">
              {displayImage ? (
                <img src={displayImage} alt={firstName} className="user-dropdown-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="user-avatar-fallback user-dropdown-avatar">
                  {displayName[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="user-dropdown-info">
                <span className="user-dropdown-name">{displayName}</span>
                <span className="user-dropdown-email">{email}</span>
              </div>
            </div>

            <div className="user-dropdown-divider" />

            <button
              className="user-dropdown-item"
              onClick={() => { setOpen(false); setShowProfile(true); }}
            >
              <span className="user-dropdown-item-icon">👤</span>
              Profile
            </button>

            <button
              className="user-dropdown-item"
              onClick={() => { setOpen(false); onSignOut ? onSignOut() : signOut({ callbackUrl: '/' }); }}
            >
              <span className="user-dropdown-item-icon">↩</span>
              Sign out
            </button>

            <div className="user-dropdown-divider" />

            <button
              className={`user-dropdown-item danger${confirmDelete ? ' confirming' : ''}`}
              onClick={handleDeleteAccount}
            >
              <span className="user-dropdown-item-icon">🗑</span>
              {confirmDelete ? 'Confirm — click again' : 'Delete account'}
            </button>
          </div>
        )}
      </div>

      {showProfile && (
        <ProfileModal
          currentName={displayName}
          currentImage={displayImage}
          onSave={handleProfileSave}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}
