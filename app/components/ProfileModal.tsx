'use client';
import { useState, useRef } from 'react';

interface Props {
  currentName: string;
  currentImage: string | null;
  onSave: (name: string, image?: string) => void;
  onClose: () => void;
}

export default function ProfileModal({ currentName, currentImage, onSave, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const [previewImage, setPreviewImage] = useState<string | null>(currentImage);
  const [imageChanged, setImageChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 256;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewImage(dataUrl);
        setImageChanged(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const trimmed = name.trim() || currentName;
    if (imageChanged && previewImage) {
      onSave(trimmed, previewImage);
    } else {
      onSave(trimmed);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="profile-modal-card">
        <h2 className="profile-modal-title">Edit Profile</h2>

        <div className="profile-avatar-section">
          <div
            className="profile-avatar-wrapper"
            onClick={() => fileInputRef.current?.click()}
            title="Click to change photo"
          >
            {previewImage ? (
              <img src={previewImage} alt="Profile" className="profile-avatar-preview" />
            ) : (
              <div className="profile-avatar-fallback">
                {(name?.[0] ?? 'U').toUpperCase()}
              </div>
            )}
            <div className="profile-avatar-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
          <span className="profile-avatar-hint">Click to change photo</span>
        </div>

        <div className="profile-field">
          <label className="profile-field-label" htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            type="text"
            className="profile-field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="profile-modal-actions">
          <button className="profile-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="profile-btn-save" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
