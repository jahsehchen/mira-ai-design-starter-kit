import { useUiStore } from '../../stores/uiStore';
import { Button } from './Button';

/**
 * 二次确认弹窗（危险操作必须使用，danger 语义色）。
 * 由 uiStore.openConfirm() 唤起，返回 Promise<boolean>。
 */
export function ConfirmDialog() {
  const confirm = useUiStore((s) => s.confirm);
  const closeConfirm = useUiStore((s) => s.closeConfirm);

  if (!confirm) return null;

  return (
    <div className="modal-mask" role="dialog" aria-modal="true" aria-label={confirm.title}>
      <div className="modal">
        <h3 className="modal-title">{confirm.title}</h3>
        <p className="modal-desc">{confirm.description}</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => closeConfirm(false)}>
            取消
          </Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
            {confirm.confirmText ?? '确定'}
          </Button>
        </div>
      </div>
    </div>
  );
}
