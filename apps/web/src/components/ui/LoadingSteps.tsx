import type { GenerationStep, StepState } from '@mira/contracts';

interface LoadingStepsProps {
  steps: GenerationStep[];
  current?: StepState;
}

/**
 * 生成三步进度环（诚实原则：不伪造百分比）。
 * 每步状态：pending / current / done。
 */
export function LoadingSteps({ steps }: LoadingStepsProps) {
  return (
    <ul className="gen-steps">
      {steps.map((step) => (
        <li key={step.key} className={step.state === 'done' ? 'done' : step.state === 'current' ? 'current' : ''}>
          <span className="step-icon" aria-hidden="true">
            {step.state === 'done' ? '✓' : ''}
          </span>
          {step.label}
        </li>
      ))}
    </ul>
  );
}
