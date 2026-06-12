'use client';

import { useState, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Player } from '@/lib/types';

export interface PlayerFormData {
  name: string;
  /** Existing Cloudinary URL (kept when no new file is selected) */
  photo: string;
  /** Newly selected file — parent uploads this to Cloudinary before saving */
  photoFile: File | null;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  role: Player['role'];
  isWicketKeeper: boolean;
}

interface PlayerFormProps {
  initial?: Partial<Omit<PlayerFormData, 'photoFile'>>;
  onSubmit: (data: PlayerFormData) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

const BATTING_TYPES: Player['battingType'][] = ['Right-Hand Bat', 'Left-Hand Bat'];
const BOWLING_TYPES: Player['bowlingType'][] = [
  'Right-Arm Fast',
  'Right-Arm Medium',
  'Right-Arm Off-Spin',
  'Right-Arm Leg-Spin',
  'Left-Arm Fast',
  'Left-Arm Medium',
  'Left-Arm Spin',
  'N/A',
];
const ROLES: Player['role'][] = ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper Batter'];

export default function PlayerForm({
  initial,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [existingPhoto, setExistingPhoto] = useState(initial?.photo ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [battingType, setBattingType] = useState<Player['battingType']>(
    initial?.battingType ?? 'Right-Hand Bat'
  );
  const [bowlingType, setBowlingType] = useState<Player['bowlingType']>(
    initial?.bowlingType ?? 'N/A'
  );
  const [role, setRole] = useState<Player['role']>(initial?.role ?? 'Batter');
  const [isWicketKeeper, setIsWicketKeeper] = useState(initial?.isWicketKeeper ?? false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous object URL to avoid memory leak
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(null);
    setPreviewUrl('');
    setExistingPhoto('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const displaySrc = previewUrl || existingPhoto;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      name,
      photo: existingPhoto,
      photoFile,
      battingType,
      bowlingType,
      role,
      isWicketKeeper,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="player-name">Player Name</Label>
        <Input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Virat Kohli"
          required
          disabled={loading}
        />
      </div>

      {/* Photo */}
      <div className="space-y-1.5">
        <Label>Photo</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            aria-label={displaySrc ? 'Change photo' : 'Upload photo'}
            className="relative group shrink-0 rounded-full focus:outline-none"
          >
            {displaySrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displaySrc}
                alt="preview"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/40 ring-offset-2 ring-offset-card transition-all duration-200 group-hover:ring-primary/70"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/5">
                <Camera className="w-6 h-6 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            )}
            {/* Hover overlay */}
            <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {displaySrc ? 'Looking good!' : 'Add a photo'}
            </p>
            <p className="text-xs text-muted-foreground">
              {displaySrc ? 'Click the photo to change it' : 'Shown on your player card'}
            </p>
            {displaySrc && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors w-fit mt-0.5"
              >
                <X className="w-3 h-3" /> Remove photo
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      {/* Batting Type */}
      <div className="space-y-1.5">
        <Label>Batting Type</Label>
        <Select
          value={battingType}
          onValueChange={(v) => setBattingType(v as Player['battingType'])}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select batting type" />
          </SelectTrigger>
          <SelectContent>
            {BATTING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bowling Type */}
      <div className="space-y-1.5">
        <Label>Bowling Type</Label>
        <Select
          value={bowlingType}
          onValueChange={(v) => setBowlingType(v as Player['bowlingType'])}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select bowling type" />
          </SelectTrigger>
          <SelectContent>
            {BOWLING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label>Player Role</Label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as Player['role'])}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Wicket Keeper */}
      <button
        type="button"
        role="switch"
        aria-checked={isWicketKeeper}
        disabled={loading}
        onClick={() => setIsWicketKeeper((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
          isWicketKeeper
            ? 'border-green-500/40 bg-green-500/8'
            : 'border-border bg-input hover:border-primary/30'
        }`}
      >
        <span>
          <span className="block text-sm font-medium text-foreground">Wicket Keeper</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Adds the WK badge to your card</span>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
            isWicketKeeper ? 'bg-green-600' : 'bg-muted-foreground/25'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
              isWicketKeeper ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </span>
      </button>

      <button
        type="submit"
        disabled={loading}
        className="btn-premium w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
      >
        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
