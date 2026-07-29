/**
 * 汎用 UI 部品。
 * シート（ボトムシート／ダイアログ）、セグメンテッドコントロール、スイッチ、メニューなど。
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { IconArrowLeft, IconCheck } from './icons';

/* ------------------------------ Sheet ------------------------------ */

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  headerExtra?: ReactNode;
}

/** モバイルではボトムシート、デスクトップでは中央ダイアログとして表示する */
export function Sheet({ title, onClose, children, footer, wide, headerExtra }: SheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // 端末の戻るボタン・ブラウザバックでも閉じられるようにする
  useBackDismiss(onClose);

  // Esc キーで閉じる & 背面のスクロールを止める
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      ref={backdropRef}
      onPointerDown={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
      role="presentation"
    >
      <div className={`sheet${wide ? ' sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__header">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="戻る"
            title="戻る"
          >
            <IconArrowLeft />
          </button>
          <h2 className="sheet__title">{title}</h2>
          {headerExtra}
        </div>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------ SegmentedControl ------------------------ */

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`segmented__item${value === option.id ? ' segmented__item--active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.hint ? <small>{option.hint}</small> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Switch ----------------------------- */

interface SwitchRowProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ title, description, checked, onChange, disabled }: SwitchRowProps) {
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <div className="switch-row__title">{title}</div>
        {description ? <div className="switch-row__desc">{description}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        className={`switch${checked ? ' switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

/* ------------------------------- Menu ------------------------------ */

interface PopoverMenuProps {
  onClose: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
}

/** ボタンの下に表示するポップオーバーメニュー */
export function PopoverMenu({ onClose, children, align = 'right' }: PopoverMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // 同一クリックで即閉じないよう次のタスクで登録する
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="menu"
      ref={ref}
      role="menu"
      style={align === 'right' ? { right: 0, top: '100%', marginTop: 6 } : { left: 0, top: '100%', marginTop: 6 }}
    >
      {children}
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  checked?: boolean;
}

export function MenuItem({ onClick, children, icon, danger, checked }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu__item${danger ? ' menu__item--danger' : ''}`}
      onClick={onClick}
    >
      {icon ?? null}
      <span style={{ flex: 1 }}>{children}</span>
      {checked ? <IconCheck size={16} /> : null}
    </button>
  );
}

/* ------------------------------ Field ------------------------------ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}
