'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt="preview"
              className="w-20 h-20 rounded-full object-cover border-2 border-green-400"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-2xl border-2 border-dashed border-border">
              📷
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              {displaySrc ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {displaySrc && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                disabled={loading}
              >
                Remove
              </Button>
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
      <div className="flex items-center gap-3">
        <input
          id="isWK"
          type="checkbox"
          checked={isWicketKeeper}
          onChange={(e) => setIsWicketKeeper(e.target.checked)}
          disabled={loading}
          className="h-4 w-4 accent-green-600 cursor-pointer"
        />
        <Label htmlFor="isWK" className="cursor-pointer">Is Wicket Keeper</Label>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-green-700 hover:bg-green-600 text-white"
      >
        {loading ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
