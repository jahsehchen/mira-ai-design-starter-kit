import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseFieldProps {
  label?: string;
  hint?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {
  textarea?: false;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {
  textarea: true;
}

type FieldProps = InputProps | TextareaProps;

/**
 * 输入框 / 文本域：44px 高（移动强制）、圆角 10px、focus 墨蓝 + accent-100 ring。
 */
export function Input(props: FieldProps) {
  const { label, hint, textarea, className = '', ...rest } = props;

  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {textarea ? (
        <textarea className={`input ${className}`.trim()} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input className={`input ${className}`.trim()} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <p className="input-hint">{hint}</p>}
    </div>
  );
}
