'use client';

import { useState, useRef } from 'react';
import { Camera, X, ShieldCheck, FileText, Upload, ReceiptIndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { localPhoneDigits, formatIndianPhone } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IdProofType, Player } from '@/lib/types';
import { ID_PROOF_TYPES } from '@/lib/types';

export interface PlayerFormData {
  name: string;
  /** Player's own email — links their card to their own account instead of the creator's */
  email: string;
  /** Personal contact number — optional, kept for the organiser's records */
  contactNumber: string;
  /** Existing Cloudinary URL (kept when no new file is selected) */
  photo: string;
  /** Newly selected file — parent uploads this to Cloudinary before saving */
  photoFile: File | null;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  role: Player['role'];
  isWicketKeeper: boolean;
  /** Which document `idProofUrl`/`idProofFile` is — null when none is on file */
  idProofType: IdProofType | null;
  /** Existing Cloudinary URL of the identity document (kept when no new file is picked) */
  idProofUrl: string;
  /** Newly picked document — parent uploads it to Cloudinary before saving */
  idProofFile: File | null;
  /** Existing Cloudinary URL of this league's entry-fee receipt */
  paymentProofUrl: string;
  /** Newly picked receipt — parent uploads it to Cloudinary before saving */
  paymentProofFile: File | null;
}

interface PlayerFormProps {
  initial?: Partial<Omit<PlayerFormData, 'photoFile' | 'idProofFile' | 'paymentProofFile'>>;
  onSubmit: (data: PlayerFormData) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  /** Show the "player's email" field — used when a creator adds a player on their behalf */
  showEmailField?: boolean;
  /**
   * Show the identity-proof section. Profile only: the document belongs to the
   * *account*, not to a per-league card, and it must never be collected on a
   * form whose output ends up on a card.
   */
  showIdProof?: boolean;
  /**
   * Show the entry-fee receipt upload. Per-*league*, unlike the identity proof:
   * the receipt is attached to this card, so this is set by the league's
   * `paymentProofRequired` rather than by which form is being rendered.
   */
  showPaymentProof?: boolean;
  /** Block submission until a receipt is attached. */
  requirePaymentProof?: boolean;
  /**
   * `stacked` (default) is the narrow one-field-per-row form used inside a
   * dialog-width card. `grid` spreads the same fields across a page-wide
   * two-column layout with the photo in its own column, so a full card fits on
   * one screen without scrolling.
   */
  layout?: 'stacked' | 'grid';
  /**
   * `id` for the `<form>`, so a submit button rendered outside it (the mobile
   * header action) can drive it with `form="…"`.
   */
  formId?: string;
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
/** The form is `noValidate`, so the browser's `type="email"` check is ours now. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PlayerForm({
  initial,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
  showEmailField = false,
  showIdProof = false,
  showPaymentProof = false,
  requirePaymentProof = false,
  layout = 'stacked',
  formId,
}: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phone, setPhone] = useState(localPhoneDigits(initial?.contactNumber));
  const [phoneError, setPhoneError] = useState('');
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
  const [idProofType, setIdProofType] = useState<IdProofType | ''>(initial?.idProofType ?? '');
  const [existingProof, setExistingProof] = useState(initial?.idProofUrl ?? '');
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [proofError, setProofError] = useState('');
  const [existingPayment, setExistingPayment] = useState(initial?.paymentProofUrl ?? '');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);
  const paymentRef = useRef<HTMLInputElement>(null);

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

  function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setIdProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setProofError('');
  }

  function handleRemoveProof() {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setIdProofFile(null);
    setProofPreview('');
    setExistingProof('');
    setIdProofType('');
    setProofError('');
    if (proofRef.current) proofRef.current.value = '';
  }

  function handlePaymentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setPaymentProofFile(file);
    setPaymentPreview(URL.createObjectURL(file));
    setPaymentError('');
  }

  function handleRemovePayment() {
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setPaymentProofFile(null);
    setPaymentPreview('');
    setExistingPayment('');
    if (paymentRef.current) paymentRef.current.value = '';
  }

  const displaySrc = previewUrl || existingPhoto;
  const proofSrc = proofPreview || existingProof;
  const paymentSrc = paymentPreview || existingPayment;

  /**
   * Rejects a submit with both an inline message and a toast. The toast is what
   * makes the header's submit button usable on a phone: the field that failed
   * is usually scrolled out of sight, so an inline message alone reads as the
   * button doing nothing.
   */
  function reject(message: string, setError: (m: string) => void, focusId?: string) {
    setError(message);
    toast.error(message);
    const el = focusId ? document.getElementById(focusId) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `noValidate` on the form hands every check below to us, so that a failure
    // always surfaces the same way instead of as a native bubble.
    if (!name.trim()) {
      return reject('Player name is required.', setNameError, 'player-name');
    }
    setNameError('');
    if (showEmailField && email.trim() && !EMAIL_RE.test(email.trim())) {
      return reject('Enter a valid email address, or leave it blank.', setEmailError, 'player-email');
    }
    setEmailError('');
    if (phone.length !== 10) {
      return reject(
        phone ? 'Enter a valid 10-digit phone number.' : 'Phone number is required.',
        setPhoneError,
        'player-phone',
      );
    }
    setPhoneError('');
    // A document with no type is unusable to an organizer, so it's caught here
    // rather than uploaded and rejected by the API.
    if (showIdProof && proofSrc && !idProofType) {
      return reject('Choose which document this is.', setProofError);
    }
    setProofError('');
    if (showPaymentProof && requirePaymentProof && !paymentSrc) {
      return reject('This league needs proof of the entry fee.', setPaymentError);
    }
    setPaymentError('');
    await onSubmit({
      name,
      email: email.trim(),
      contactNumber: formatIndianPhone(phone),
      photo: existingPhoto,
      photoFile,
      battingType,
      bowlingType,
      role,
      isWicketKeeper,
      idProofType: proofSrc ? (idProofType || null) : null,
      idProofUrl: existingProof,
      idProofFile,
      paymentProofUrl: existingPayment,
      paymentProofFile,
    });
  }

  const grid = layout === 'grid';
  /** Full-width fields inside the two-column field grid. No-op when stacked. */
  const span2 = grid ? 'sm:col-span-2' : '';
  /** Selects are `w-fit` by default, which reads as ragged inside the grid. */
  const triggerClass = grid ? 'w-full' : undefined;

  const photoPicker = (size: string) => (
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
          className={`${size} rounded-full object-cover ring-2 ring-primary/40 ring-offset-2 ring-offset-card transition-all duration-200 group-hover:ring-primary/70`}
        />
      ) : (
        <div className={`${size} rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/5`}>
          <Camera className="w-6 h-6 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      )}
      {/* Hover overlay */}
      <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <Camera className="w-5 h-5 text-white" />
      </span>
    </button>
  );

  const removePhotoButton = (
    <button
      type="button"
      onClick={handleRemovePhoto}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors w-fit"
    >
      <X className="w-3 h-3" /> Remove photo
    </button>
  );

  /* Photo beside its caption — the stacked layout's version. */
  const photoRow = (
    <div className="space-y-1.5">
      <Label>Photo</Label>
      <div className="flex items-center gap-4">
        {photoPicker('w-20 h-20')}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {displaySrc ? 'Looking good!' : 'Add a photo'}
          </p>
          <p className="text-xs text-muted-foreground">
            {displaySrc ? 'Click the photo to change it' : 'Shown on your player card'}
          </p>
          {displaySrc && <span className="mt-0.5">{removePhotoButton}</span>}
        </div>
      </div>
    </div>
  );

  /* Photo as a column of its own — the wide layout's version. */
  const photoPanel = (
    <div className="rounded-2xl border border-border bg-muted/25 p-5 flex flex-col items-center text-center gap-3">
      {photoPicker('w-28 h-28')}
      <div>
        <p className="text-sm font-medium text-foreground">
          {displaySrc ? 'Looking good!' : 'Add a photo'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {displaySrc ? 'Click the photo to change it' : 'Tap the circle to upload — shown on your card'}
        </p>
      </div>
      {displaySrc && removePhotoButton}
    </div>
  );

  const fields = (
    <>
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="player-name">Player Name</Label>
        <Input
          id="player-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          placeholder="e.g. Virat Kohli"
          required
          aria-invalid={!!nameError}
          disabled={loading}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>

      {/* Email — links this card to the player's own account, not the creator's */}
      {showEmailField && (
        <div className="space-y-1.5">
          <Label htmlFor="player-email">Player&apos;s Email (optional)</Label>
          <Input
            id="player-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError('');
            }}
            placeholder="player@example.com"
            aria-invalid={!!emailError}
            disabled={loading}
          />
          {emailError ? (
            <p className="text-xs text-destructive">{emailError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Links this card to the player&apos;s own account. Leave blank to add an unclaimed card.
            </p>
          )}
        </div>
      )}

      {/* Phone Number */}
      <div className="space-y-1.5">
        <Label htmlFor="player-phone">Phone Number</Label>
        <div
          className={`flex items-stretch rounded-md border bg-transparent overflow-hidden focus-within:ring-1 ${
            phoneError ? 'border-destructive focus-within:ring-destructive' : 'border-input focus-within:ring-ring'
          }`}
        >
          <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted/60 border-r border-input select-none">
            +91
          </span>
          <Input
            id="player-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
              if (phoneError) setPhoneError('');
            }}
            placeholder="98765 43210"
            maxLength={10}
            required
            aria-invalid={!!phoneError}
            className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={loading}
          />
        </div>
        {phoneError ? (
          <p className="text-xs text-destructive">{phoneError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Kept for the organiser&apos;s records — not shown on your card.</p>
        )}
      </div>

      {/* Photo — the wide layout gives it a column, so only stacked shows it inline */}
      {!grid && photoRow}

      {/* Batting Type */}
      <div className="space-y-1.5">
        <Label>Batting Type</Label>
        <Select
          value={battingType}
          onValueChange={(v) => setBattingType(v as Player['battingType'])}
          disabled={loading}
        >
          <SelectTrigger className={triggerClass}>
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
          <SelectTrigger className={triggerClass}>
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
          <SelectTrigger className={triggerClass}>
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
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${span2} ${
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

      {/* Identity proof — profile only. Organizers of a league you hold a card
          in can open the document; it never reaches a card, poster or PDF. */}
      {showIdProof && (
        <div className={`space-y-3 rounded-xl border border-border bg-muted/25 p-4 ${span2}`}>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Identity Proof (optional)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Some leagues require one to register. Only the organizers of a league you join can
                open it — it is never shown on your player card, posters or downloads.
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 group"
            onClick={() => proofRef.current?.click()}
          >
            {proofSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofSrc} alt="Identity document preview"
                className="w-14 h-14 rounded-lg object-cover border border-border bg-muted" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary/30 transition-colors">
                <Upload className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {proofSrc ? 'Change document' : 'Upload document'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">A clear photo of the ID — PNG or JPG</p>
            </div>
            {proofSrc && (
              <button
                type="button"
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); handleRemoveProof(); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
          <input ref={proofRef} type="file" accept="image/*" className="hidden" onChange={handleProofChange} />

          {proofSrc && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />Document Type
              </Label>
              <Select
                value={idProofType}
                onValueChange={(v) => { setIdProofType(v as IdProofType); setProofError(''); }}
                disabled={loading}
              >
                <SelectTrigger className={triggerClass}>
                  <SelectValue placeholder="What is this document?" />
                </SelectTrigger>
                <SelectContent>
                  {ID_PROOF_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {proofError && <p className="text-xs text-destructive">{proofError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Entry-fee receipt — shown only for leagues that ask for one, because a
          payment upload on a free league's form is just noise. Organizer-only,
          same as the ID: it never reaches a card, poster or download. */}
      {showPaymentProof && (
        <div className={`space-y-2.5 rounded-xl border border-border bg-muted/25 p-4 ${span2}`}>
          <div className="flex items-start gap-2">
            <ReceiptIndianRupee className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Payment Proof{requirePaymentProof ? '' : ' (optional)'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A screenshot or photo of the entry-fee payment. Only this league&apos;s organizers can open it.
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 group ${
              paymentError ? 'border-destructive/50' : 'border-border'
            }`}
            onClick={() => paymentRef.current?.click()}
          >
            {paymentSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paymentSrc} alt="Payment receipt preview"
                className="w-14 h-14 rounded-lg object-cover border border-border bg-muted" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary/30 transition-colors">
                <Upload className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {paymentSrc ? 'Change receipt' : 'Upload receipt'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Screenshot of the transfer — PNG or JPG</p>
            </div>
            {paymentSrc && (
              <button
                type="button"
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); handleRemovePayment(); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
          <input ref={paymentRef} type="file" accept="image/*" className="hidden" onChange={handlePaymentChange} />
          {paymentError && <p className="text-xs text-destructive">{paymentError}</p>}
        </div>
      )}
    </>
  );

  const submitButton = (
    <button
      type="submit"
      disabled={loading}
      className="btn-premium w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
    >
      {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
      {loading ? 'Saving…' : submitLabel}
    </button>
  );

  const photoInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handlePhotoChange}
    />
  );

  // Wide layout: the photo and the submit button own a narrow left column while
  // the fields fill a two-up grid beside them, so the whole form lands on one
  // screen. Below `lg` it collapses to DOM order — photo, fields, submit.
  if (grid) {
    return (
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit}
        className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start"
      >
        <div className="lg:col-start-1 lg:row-start-1">{photoPanel}</div>
        <div className="grid gap-4 sm:grid-cols-2 content-start lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {fields}
        </div>
        <div className="lg:col-start-1 lg:row-start-2">{submitButton}</div>
        {photoInput}
      </form>
    );
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-5">
      {fields}
      {submitButton}
      {photoInput}
    </form>
  );
}
