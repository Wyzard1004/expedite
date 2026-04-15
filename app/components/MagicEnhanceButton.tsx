'use client';

interface MagicEnhanceButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export default function MagicEnhanceButton({
  disabled,
  loading,
  onClick,
}: MagicEnhanceButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Enhancing your review...
        </>
      ) : (
        <>
          ✨ Magic Enhance
        </>
      )}
    </button>
  );
}
